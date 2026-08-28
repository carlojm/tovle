import { S3Client, PutObjectCommand,
  //these three are for the opengraph cleanup
  HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand
} from '@aws-sdk/client-s3'

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


async function existsInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

async function cleanupOldOgImages(daysToKeep = 31) {
  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000

  const list = await r2.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: 'og/',
  }))

  if (!list.Contents?.length) return { deleted: 0 }

  const toDelete = list.Contents
    .filter(obj => obj.LastModified && obj.LastModified.getTime() < cutoff)
    .map(obj => ({ Key: obj.Key }))

  if (!toDelete.length) return { deleted: 0 }

  await r2.send(new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: { Objects: toDelete },
  }))

  console.log(`[r2] Deleted ${toDelete.length} old OG images`)
  return { deleted: toDelete.length }
}


export { uploadToR2, testR2, existsInR2, cleanupOldOgImages }
