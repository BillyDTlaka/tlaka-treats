module.exports = function (api) {
  const isTest = api.env('test')
  api.cache(() => isTest)
  return {
    presets: [
      [
        'babel-preset-expo',
        // Disable the reanimated babel plugin in tests — react-native-worklets
        // (its peer dependency) is not installed in this repo.
        isTest ? { reanimated: false } : {},
      ],
    ],
  }
}
