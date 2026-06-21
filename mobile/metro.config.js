const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// supabase-js, opsiyonel @opentelemetry/api'yi dinamik import eder; kurulu
// olmadığından Metro çözemiyor. Opsiyonel olduğu için boş modüle yönlendiriyoruz.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@opentelemetry/api') {
    return { type: 'empty' };
  }
  return (originalResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
