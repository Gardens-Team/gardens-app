module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'expo-router/babel',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@app': './app',
            '@components': './src/components',
            '@screens': './src/screens',
            '@services': './src/services',
            '@db': './src/db'
          },
        },
      ],
    ],
  };
}; 