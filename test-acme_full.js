import acme from 'acme-client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// 生成阿里云 API 签名
function generateSignature(params, secret) {
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
async function updateAliyunCDNCert(certData) {
  const timestamp = new Date().toISOString();
  const nonce = Math.random().toString(36).substring(2);

  const params = {
    Action: 'SetCdnDomainSSLCertificate',
    Format: 'JSON',
    Version: '2018-05-10',
    AccessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: timestamp,
    SignatureVersion: '1.0',
    SignatureNonce: nonce,
    DomainName: process.env.ALIYUN_DOMAIN_NAME,
    SSLProtocol: 'on',
    CertType: 'upload',
    CertName: `${process.env.ALIYUN_CERT_NAME || 'auto-renewed-cert'}-${new Date().getTime()}`,
    SSLPub: certData.certificate,
    SSLPri: certData.privateKey,
  };

  // 生成签名
  params.Signature = generateSignature(params, process.env.ALIYUN_ACCESS_KEY_SECRET);

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

// 删除 Cloudflare DNS 记录
async function removeCloudflareDNS(challengeDomain, dnsRecord) {
  // 获取现有的记录
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/dns_records?name=${challengeDomain}&type=TXT`, {
    headers: {
      'X-Auth-Email': process.env.CF_EMAIL,
      'X-Auth-Key': process.env.CF_API_KEY,
      'Content-Type': 'application/json',
    },
  });
  const existingRecords = await response.json();
  if (!existingRecords.success) {
    console.log('获取现有的记录失败', existingRecords);
    throw new Error('获取现有的记录失败');
  }
  console.log('获取现有的记录成功', existingRecords);

  // 删除现有的记录
  for (const record of existingRecords.result) {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/dns_records/${record.id}`, {
      method: 'DELETE',
    });
  }
  console.log('删除现有的记录成功');
}

// 更新 Cloudflare DNS 记录
async function updateCloudflareDNS(challengeDomain, dnsRecord) {
  // 获取现有的记录
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/dns_records?name=${challengeDomain}&type=TXT`, {
    headers: {
      'X-Auth-Email': process.env.CF_EMAIL,
      'X-Auth-Key': process.env.CF_API_KEY,
      'Content-Type': 'application/json',
    },
  });
  const existingRecords = await response.json();
  if (!existingRecords.success) {
    console.log('获取现有的记录失败', existingRecords);
    throw new Error('获取现有的记录失败');
  }
  console.log('获取现有的记录成功', existingRecords);

  // 删除现有的记录
  for (const record of existingRecords.result) {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/dns_records/${record.id}`, {
      method: 'DELETE',
    });
  }
  console.log('删除现有的记录成功');

  // 添加新的记录
  const addResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/dns_records`, {
    method: 'POST',
    headers: {
      'X-Auth-Email': process.env.CF_EMAIL,
      'X-Auth-Key': process.env.CF_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'TXT',
      name: challengeDomain,
      content: dnsRecord,
      ttl: 120,
      proxied: false,
      comment: 'Let\'s Encrypt DNS-01 challenge'
    }),
  });
  const addJson = await addResponse.json();
  if (!addJson.success) {
    console.log('添加 DNS 记录失败', addJson);
    throw new Error('添加 DNS 记录失败');
  }
  console.log('添加 DNS 记录成功', addJson);

  return addJson;
}

async function testAcme() {
  try {
    // 创建私钥
    const accountKey = await acme.forge.createPrivateKey();
    console.log('私钥创建成功');

    // 创建客户端
    const client = new acme.Client({
      directoryUrl: process.env.LE_DIRECTORY_URL,
      accountKey: accountKey
    });
    console.log('客户端创建成功');

    // 获取或创建账户
    await client.createAccount({
      termsOfServiceAgreed: true,
      contact: [`mailto:${process.env.LE_EMAIL}`]
    });
    console.log('创建新账户成功');

    // 创建订单
    const order = await client.createOrder({
      identifiers: [
        { type: 'dns', value: process.env.ALIYUN_DOMAIN_NAME }
      ]
    });
    console.log('订单创建成功:', order);

    // 获取授权
    const authorizations = await client.getAuthorizations(order);
    console.log('获取授权成功:', authorizations);

    // 完成挑战
    let lastChallengeDomain = null;
    let lastDnsRecord = null;
    for (const auth of authorizations) {
      const challenge = auth.challenges.find(c => c.type === 'dns-01');
      if (!challenge) {
        console.error('未找到 DNS-01 挑战');
        continue;
      }

      console.log('找到 DNS-01 挑战:', challenge);

      const keyAuthorization = await client.getChallengeKeyAuthorization(challenge);
      const dnsRecord = keyAuthorization;
      lastDnsRecord = dnsRecord;
      const challengeDomain = `_acme-challenge.${process.env.ALIYUN_DOMAIN_NAME}`;
      lastChallengeDomain = challengeDomain;

      console.log('准备更新 DNS 记录:', {
        domain: challengeDomain,
        value: dnsRecord
      });

      // 更新 Cloudflare DNS 记录
      const result = await updateCloudflareDNS(challengeDomain, dnsRecord);
      console.log('DNS 记录更新成功:', result);

      // 等待 DNS 记录生效并验证
      console.log('等待 DNS 记录生效...');
      let retries = 0;
      let dnsVerified = false;
      
      while (retries < 10 && !dnsVerified) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log(`尝试验证 DNS 记录 (第 ${retries + 1} 次)...`);
        
        try {
          const dnsResponse = await fetch(`https://dns.google/resolve?name=${challengeDomain}&type=TXT`);
          const dnsData = await dnsResponse.json();
          
          if (dnsData.Answer && dnsData.Answer.some(answer => answer.data.includes(dnsRecord))) {
            console.log('DNS 记录已生效');
            dnsVerified = true;
          } else {
            console.log('DNS 记录尚未生效，继续等待...');
            retries++;
          }
        } catch (error) {
          console.log('DNS 查询失败，继续等待...', error);
          retries++;
        }
      }

      if (!dnsVerified) {
        throw new Error('DNS 记录验证超时');
      }

      console.log('开始验证挑战...');
      let retryCount = 0;
      let challengeVerified = false;
      
      while (retryCount < 3 && !challengeVerified) {
        try {
          await client.verifyChallenge(auth, challenge);
          console.log('挑战验证成功');
          challengeVerified = true;
        } catch (error) {
          retryCount++;
          console.log(`挑战验证失败 (第 ${retryCount} 次)，等待后重试...`, error);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      if (!challengeVerified) {
        throw new Error('挑战验证失败，已达到最大重试次数');
      }

      console.log('完成挑战...');
      await client.completeChallenge(challenge);
      console.log('挑战完成');

      // 等待挑战状态更新
      console.log('等待挑战状态更新...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // 减少到 2 秒
    }

    // 等待挑战完成
    await client.waitForValidStatus(order);
    console.log('挑战完成');

    // 生成证书
    const [key, csr] = await acme.forge.createCsr({
      commonName: process.env.ALIYUN_DOMAIN_NAME,
    });
    console.log('证书生成成功');

    // 完成订单
    console.log('完成订单...');
    await client.finalizeOrder(order, csr);
    console.log('订单完成');

    // 获取证书
    const cert = await client.getCertificate(order);
    console.log('证书获取成功', cert);

    // 删除记录
    if (lastChallengeDomain && lastDnsRecord) {
      await removeCloudflareDNS(lastChallengeDomain, lastDnsRecord);
    }

    // 更新阿里云 CDN 证书
    const result = await updateAliyunCDNCert({
      certificate: cert,
      privateKey: key.toString(),
    });
    console.log('阿里云 CDN 证书更新成功:', result);

  } catch (error) {
    console.error('测试失败:', error);
  }
}

testAcme(); 