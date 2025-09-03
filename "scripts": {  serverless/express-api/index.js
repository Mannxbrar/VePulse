// Express API packaged for Lambda using @vendia/serverless-express
const express = require('express');
const serverless = require('@vendia/serverless-express');
const AWS = require('aws-sdk');

const app = express();
app.use(express.json());

const region = process.env.AWS_REGION || 'us-east-1';
AWS.config.update({ region });
const ddb = new AWS.DynamoDB.DocumentClient();

app.get('/newsroom', async (req, res) => {
  try {
    const params = { TableName: process.env.DDB_TABLE_NAME, Limit: 500 };
    const data = await ddb.scan(params).promise();
    const items = (data.Items || []).map(i => {
      let ai = {};
      try { ai = i.ai ? JSON.parse(i.ai) : {}; } catch (e) {}
      return {
        id: i.fingerprint,
        title: i.title,
        headline: ai.rewritten_headline || i.title,
        summary: ai.summary || (i.body || '').slice(0,300),
        source: i.source || 'unknown',
        image: i.image || null
      };
    });
    res.json({ articles: items });
  } catch (err) {
    console.error('newsroom err', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/health', (req, res) => res.json({ ok: true }));

exports.handler = serverless({ app });
