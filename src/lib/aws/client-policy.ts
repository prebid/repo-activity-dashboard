export const awsClientPolicy = {
  maxAttempts: 2,
  requestHandler: {
    connectionTimeout: 1000,
    requestTimeout: 3000,
    socketTimeout: 3000,
    throwOnRequestTimeout: true,
  },
};
