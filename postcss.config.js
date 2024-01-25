// export default {
//   plugins: {
//     tailwindcss: {},
//     autoprefixer: {},
//   },
// }
module.exports = {
  syntax: 'postcss-lit',
  plugins: {
    tailwindcss: {
      config: './tailwind.config.cjs'
    }
  }
};