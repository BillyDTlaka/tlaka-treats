const React = require('react')

const useSafeAreaInsets = () => ({ top: 44, bottom: 34, left: 0, right: 0 })

const SafeAreaProvider = ({ children }) => children
const SafeAreaView = ({ children }) => children

module.exports = { useSafeAreaInsets, SafeAreaProvider, SafeAreaView }
