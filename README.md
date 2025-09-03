```markdown
# VePulse — Titan (Bedrock) Newsroom + Dispatchers (Browser-first)

Short progress story
I prepared a full scaffold for VePulse (ingest Lambda + /newsroom API + minimal frontend) and a GitHub Actions build so you can do everything from a browser (no local installs). You already have README.md — paste the content below to give yourself a clear, browser-only playbook that walks you from repository → Actions build → downloadable Lambda zip → AWS Console deploy → Vercel frontend.

What this repo contains
- serverless/bedrock-ingest — ingest Lambda (calls Bedrock/Titan, dedupes, stores to DynamoDB, uploads images to S3)
- serverless/express-api — simple /newsroom service (reads DynamoDB)
- .github/workflows/* — Actions that build zips you can download from the Actions UI
- web — minimal frontend you can deploy to Vercel

Browser-only quick path (one line)
1) Commit the scaffold files in GitHub web editor → 2) wait for Actions to build → 3) download artifact zips → 4) create AWS resources & upload zips in AWS Console → 5) create Lambda Function URLs → 6) deploy frontend to Vercel and set NEXT_PUBLIC_API_URL.

Prerequisites (in the browser)
- GitHub account (you already have a repo and a README file)
- AWS account with Bedrock access (region like us-east-1). You will use the AWS Console (browser).
- Vercel account to deploy the frontend (optional but recommended)
- A browser HTTP client to test endpoints (Hoppscotch https://hoppscotch.io or Postman web)

Step-by-step (copy these steps when ready)

A — Prepare repository (GitHub web UI)
1. If your repo had no main branch, creating README.md already created it. Good.
2. Use "Add file → Create new file" in GitHub to add the scaffold files under:
   - serverless/bedrock-ingest/index.js
   - serverless/bedrock-ingest/package.json
   - serverless/express-api/index.js
   - serverless/express-api/package.json
   - web/index.html and web/package.json
   - .github/workflows/build_ingest.yml
   - .github/workflows/build_express.yml
   Commit each file to the main branch (or push a branch and open a PR).

B — Build artifacts in GitHub Actions (cloud)
3. After you push the files, open the "Actions" tab in the repository. Wait for the two workflows to complete:
   - "Build Ingest Lambda"
   - "Build Express API"
4. Open each workflow run and download the artifact(s) (Artifacts section) — these are zipped code packages you will upload to Lambda. Save them to your browser download folder.

C — Create AWS resources (AWS Console, browser)
5. S3: Create an S3 bucket for article images (example: `vepulse-articles-bucket`).
6. DynamoDB: Create table `VePulseArticles` with partition key `fingerprint` (String).
7. IAM role: Create a Lambda execution role
   - Trusted entity: AWS Lambda
   - Attach policy AWSLambdaBasicExecutionRole
   - Add an inline policy that allows:
     - s3:PutObject / s3:GetObject on your bucket
     - dynamodb:GetItem / PutItem / Scan on your table
     - bedrock:InvokeModel (resource "*")
   (You can paste the policy body in the Console editor and replace REGION / ACCOUNT_ID placeholders.)

D — Create Lambda functions & upload zips (AWS Console, browser)
8. Create Lambda function `vepulse-bedrock-ingest` (Node.js 18.x)
   - Under "Code" → Upload from → ".zip file" — upload the ingest artifact zip from GitHub Actions.
   - Handler: `index.handler`
   - Environment variables (Configuration → Environment variables):
     - AWS_REGION=us-east-1
     - S3_BUCKET_NAME=vepulse-articles-bucket
     - DDB_TABLE_NAME=VePulseArticles
     - BEDROCK_MODEL_ID=amazon.titan-text-instruct
     - API_AUTH_KEY=<pick-a-secret-string>
   - Set the function's execution role to the role you created.
9. Create a second Lambda for the express artifact (or, if you prefer, deploy a simpler /newsroom Lambda I can give you). Upload the express zip the same way.

E — Create public endpoints (fastest: Lambda Function URLs)
10. In each Lambda's "Configuration" → "Function URL" → Create function URL:
    - Choose CORS config if needed.
    - Use the Function URL as your HTTP endpoint.
    - The ingest Lambda checks the `x-api-key` header against API_AUTH_KEY — keep it secret.
11. Alternatively, create API Gateway and map routes:
    - POST /ingest → ingest Lambda
    - GET /newsroom → express Lambda (or newsroom Lambda)

F — Test endpoints from the browser
12. Use Hoppscotch or Postman web to test:
    - POST to ingest Function URL
      - Header: x-api-key: <your API_AUTH_KEY>
      - JSON body example:
        {"title":"Test article","body":"Short body for testing","source":"Library News"}
    - GET /newsroom Function URL — should return JSON list of articles.
13. Inspect S3 and DynamoDB in the AWS Console to confirm items and images exist.

G — Deploy frontend to Vercel (browser)
14. Go to https://vercel.com → Import Project → connect your GitHub repo.
15. Set Environment Variable on Vercel project:
    - NEXT_PUBLIC_API_URL = <your /newsroom function URL root>
16. Deploy and open the Vercel URL to see the Newsroom UI.

Environment variables (summary)
- AWS_REGION — AWS region for Bedrock (e.g., us-east-1)
- S3_BUCKET_NAME — bucket for images
- DDB_TABLE_NAME — DynamoDB table name (VePulseArticles)
- BEDROCK_MODEL_ID — e.g., amazon.titan-text-instruct
- API_AUTH_KEY — shared secret header for ingest
- NEXT_PUBLIC_API_URL — frontend config pointing to /newsroom

Testing tips (browser-only)
- Use Hoppscotch (https://hoppscotch.io) for POST/GET requests from the library PC.
- If Lambda returns 401, confirm your x-api-key header matches API_AUTH_KEY.
- If Bedrock calls fail, check CloudWatch logs (Lambda → Monitoring → View logs in CloudWatch) in the AWS Console.

If you want a simpler /newsroom Lambda (no Express) so packaging and Function URL are trivial, say: "Give me newsroom lambda" — I'll paste a single-file handler and a small GitHub Action workflow to build it. That will make the deploy steps even easier from the browser.

What's next (I already did)
I prepared the scaffold and the cloud build workflows so you can complete everything using only the GitHub web UI, Actions artifacts, and the AWS Console. Paste this README.md into your repo now and then add the scaffold files (I can paste them for you next). After you commit them, open Actions and follow the steps above to get the zip artifacts and continue deploying entirely from the browser.
```
