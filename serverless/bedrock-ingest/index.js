// Minimal ingest Lambda (Node 18 CommonJS).
// IMPORTANT: Set Lambda env vars: AWS_REGION, S3_BUCKET_NAME, DDB_TABLE_NAME, BEDROCK_MODEL_ID, API_AUTH_KEY
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET_NAME || '';
const DDB_TABLE = process.env.DDB_TABLE_NAME || '';
const BEDROCK_MODEL = process.env.BEDROCK_MODEL_ID || 'amazon.titan-text-instruct';
const API_AUTH_KEY = process.env.API_AUTH_KEY || '';

const s3 = new S3Client({ region: REGION });
const ddb = new DynamoDBClient({ region: REGION });
const bedrock = new BedrockRuntimeClient({ region: REGION });

function fingerprint(title = '', body = '') {
  const normalized = (title + '|' + body).replace(/\s+/g, ' ').trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function callBedrock(prompt) {
  const cmd = new InvokeModelCommand({
    modelId: BEDROCK_MODEL,
    body: JSON.stringify({ inputText: prompt }),
    contentType: 'application/json'
  });
  const res = await bedrock.send(cmd);
  const chunks = [];
  for await (const chunk of res.body) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(text); } catch (e) { return { raw: text }; }
}

exports.handler = async function(event) {
  try {
    const headers = event.headers || {};
    if ((headers['x-api-key'] || headers['X-API-KEY'] || '') !== API_AUTH_KEY) {
      return { statusCode: 401, body: 'Unauthorized' };
    }
    const payload = (event.body && typeof event.body === 'string') ? JSON.parse(event.body) : (event.body || {});
    const { title = '', body = '', source = '', url = '', imageBase64 } = payload;
    if (!title || !body) return { statusCode: 422, body: 'Missing title or body' };

    const fp = fingerprint(title, body);

    // dedupe check
    const getCmd = new GetItemCommand({
      TableName: DDB_TABLE,
      Key: { fingerprint: { S: fp } },
      ProjectionExpression: 'fingerprint'
    });
    const existing = await ddb.send(getCmd);
    if (existing.Item) {
      return { statusCode: 200, body: JSON.stringify({ deduped: true, fingerprint: fp }) };
    }

    // upload image if present
    let imageUrl = null;
    if (imageBase64) {
      const key = `articles/${fp}/image.jpg`;
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: Buffer.from(imageBase64, 'base64'),
        ContentType: 'image/jpeg'
      }));
      imageUrl = `https://${S3_BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
    }

    // Strict JSON output prompt
    const prompt = `You are an editor that returns strict JSON (no extra commentary).
Input:
Title: ${title}
Body: ${body}
Source: ${source}
URL: ${url}

Return exactly:
{"category":"<one-word-category>","rewritten_headline":"...","summary":"~150 words summary","hashtags":["tag1","tag2"]}`;

    const aiResult = await callBedrock(prompt);

    const item = {
      fingerprint: { S: fp },
      title: { S: title },
      body: { S: body.substring(0, 4000) },
      source: { S: source || 'unknown' },
      url: { S: url || '' },
      image: imageUrl ? { S: imageUrl } : { NULL: true },
      ai: { S: JSON.stringify(aiResult) },
      createdAt: { S: new Date().toISOString() }
    };

    await ddb.send(new PutItemCommand({
      TableName: DDB_TABLE,
      Item: item,
      ConditionExpression: 'attribute_not_exists(fingerprint)'
    }));

    return { statusCode: 201, body: JSON.stringify({ created: true, fingerprint: fp, ai: aiResult }) };
  } catch (err) {
    console.error('ingest error', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
