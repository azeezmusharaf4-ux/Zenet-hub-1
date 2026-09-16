export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      overrideBrowserslist: [
        '> 0.2%',
        'last 2 versions',
        'Android >= 4.4',
        'iOS >= 9'
      ],
    },
  },
};
