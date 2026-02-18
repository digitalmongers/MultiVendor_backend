module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.[t|j]sx?$': 'babel-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(uuid|@faker-js|@dqbd|string-width|strip-ansi|ansi-regex|wrap-ansi|is-fullwidth-code-point)/)',
    ],
};
