import acme from 'acme-client';
import { updateCloudflareDNS, removeCloudflareDNS } from './cloudflare.js';

// 获取新证书
export async function getNewCertificate(env) {
  // 创建私钥
  const accountKey = await acme.forge.createPrivateKey();
  console.log('私钥创建成功');

  // 创建客户端
  const client = new acme.Client({
    directoryUrl: process.env.LE_DIRECTORY_URL,
    accountKey: accountKey
  });

  // 获取或创建账户
  await client.createAccount({
    termsOfServiceAgreed: true,
    contact: [`mailto:${process.env.LE_EMAIL}`]
  });
  console.log('创建新账户成功');

  // 创建订单
  const order = await client.createOrder({
    identifiers: [
      { type: 'dns', value: env.ALIYUN_DOMAIN_NAME }
    ]
  });
  console.log('创建订单成功', order);

  // 获取授权
  const authorizations = await client.getAuthorizations(order);
  console.log('获取授权成功', authorizations);

  // 处理 DNS 挑战
  let lastChallengeDomain = null;
  let lastDnsRecord = null;
  for (const auth of authorizations) {
    const challenge = auth.challenges.find(c => c.type === 'dns-01');
    if (!challenge) {
      throw new Error('未找到 DNS 挑战');
    }

    const keyAuthorization = await client.getChallengeKeyAuthorization(challenge);
    const dnsRecord = keyAuthorization;
    lastChallengeDomain = `_acme-challenge.${env.ALIYUN_DOMAIN_NAME}`;
    lastDnsRecord = dnsRecord;

    // 更新 DNS 记录
    await updateCloudflareDNS(lastChallengeDomain, dnsRecord, env);

    // 等待 DNS 传播
    console.log('等待 DNS 传播...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // 验证挑战
    let retryCount = 0;
    let challengeVerified = false;
    while (retryCount < 3 && !challengeVerified) {
      try {
        await client.verifyChallenge(auth, challenge);
        challengeVerified = true;
      } catch (error) {
        retryCount++;
        console.log(`验证挑战失败，第 ${retryCount} 次重试`, error);
        if (retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          throw new Error('验证挑战失败，已达到最大重试次数');
        }
      }
    }
    console.log('验证挑战成功');

    console.log('完成挑战...');
    await client.completeChallenge(challenge);
    console.log('挑战完成');

  }

  // 等待挑战状态更新
  console.log('等待挑战状态更新...');
  await new Promise(resolve => setTimeout(resolve, 2000)); // 减少到 2 秒

  // 等待挑战完成
  await client.waitForValidStatus(order);
  console.log('挑战完成');

  // 生成 CSR
  const [key, csr] = await acme.forge.createCsr({
    commonName: env.ALIYUN_DOMAIN_NAME,
    altNames: [env.ALIYUN_DOMAIN_NAME]
  });

  // 完成订单
  const finalize = await client.finalizeOrder(order, csr);
  console.log('完成订单成功', finalize);

  // 获取证书
  const certificate = await client.getCertificate(order);
  console.log('获取证书成功');

  // 清理 DNS 记录
  if (lastChallengeDomain && lastDnsRecord) {
    await removeCloudflareDNS(lastChallengeDomain, lastDnsRecord, env);
  }

  return {
    key,
    certificate
  };
} 