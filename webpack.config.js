const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: {
    popup: "./src/popup/index.jsx",
    content: "./src/content/index.jsx",
    background: "./src/background/index.jsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        use: [
          {
            loader: "file-loader",
            options: {
              name: "/assets/images/[name].[ext]",
            },
          },
        ],
      },
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [
                  "tailwindcss",
                  "autoprefixer",
                ],
              },
            },
          },
        ],
      }
    ],
  },
  resolve: {
    extensions: [".js", ".jsx", ".tsx"],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/popup/popup.html",
      filename: "popup.html",
      chunks: ["popup"],
    }),
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),
    new CopyPlugin({
      patterns: [{ from: "public" }, { from: "src/assets/", to: "assets" }],
    }),
  ],
  target: ["web", "es5"],
};