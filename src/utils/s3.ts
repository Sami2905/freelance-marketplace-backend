import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export const uploadToS3 = async (
  fileBuffer: Buffer,
  key: string,
  contentType: string
): Promise<string> => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME || 'freelance-marketplace',
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read',
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Generate public URL
    return `https://${params.Bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Failed to upload file to storage');
  }
};

export const deleteFromS3 = async (key: string): Promise<boolean> => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME || 'freelance-marketplace',
      Key: key,
    };

    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting from S3:', error);
    return false;
  }
};

export const getSignedUploadUrl = async (key: string, contentType: string): Promise<string> => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME || 'freelance-marketplace',
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
      Expires: 60 * 5, // 5 minutes
    };

    const command = new PutObjectCommand(params);
    return getSignedUrl(s3Client, command, { expiresIn: 300 });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate upload URL');
  }
};
