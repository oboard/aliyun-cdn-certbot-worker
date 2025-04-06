import crypto from 'crypto';

// 生成阿里云 API 签名
export function generateSignature(params, secret) {
  // 1. 参数排序
  const sortedParams = Object.keys(params).sort().map(key => {
    return `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
  }).join('&');

  // 2. 构造签名字符串
  const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(sortedParams)}`;

  // 3. 计算签名
  const hmac = crypto.createHmac('sha1', secret + '&');
  const signature = hmac.update(Buffer.from(stringToSign, 'utf8')).digest('base64');

  return signature;
}

// 更新阿里云 CDN 证书
export async function updateAliyunCDNCert(certData, env) {
  const timestamp = new Date().toISOString();
  const nonce = Math.random().toString(36).substring(2);

  const params = {
    Action: 'SetCdnDomainSSLCertificate',
    Format: 'JSON',
    Version: '2018-05-10',
    AccessKeyId: env.ALIYUN_ACCESS_KEY_ID,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: timestamp,
    SignatureVersion: '1.0',
    SignatureNonce: nonce,
    DomainName: env.ALIYUN_DOMAIN_NAME,
    SSLProtocol: 'on',
    CertType: 'upload',
    CertName: `${env.ALIYUN_CERT_NAME || 'auto-renewed-cert'}-${new Date().getTime()}`,
    SSLPub: certData.certificate,
    SSLPri: certData.privateKey,
  };

  // 生成签名
  params.Signature = generateSignature(params, env.ALIYUN_ACCESS_KEY_SECRET);

  const response = await fetch('https://cdn.aliyuncs.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });

  const result = await response.json();
  if (result.Code) {
    throw new Error(`阿里云 CDN 证书更新失败: ${result.Code} - ${result.Message}`);
  }

  return result;
} 