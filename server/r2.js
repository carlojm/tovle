const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME

async function uploadToR2(key, buffer, contentType = 'image/png') {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  })
  await r2.send(command)
  return `https://images.tovle.net/${key}`
}

async function testR2() {
  const testBuffer = Buffer.from('hello from tovle')
  const url = await uploadToR2('test/hello.txt', testBuffer, 'text/plain')
  console.log('Uploaded to:', url)
  return url
}

module.exports = { uploadToR2, testR2 }