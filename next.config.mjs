/** @type {import('next').NextConfig} */
// const svgrWebpack = require('./config/svgr/svgr-webpack').default
const nextConfig = {
	webpack: (config, {webpack}) => {
		config.module.rules.push(
		{
			test : /\.(glsl|vs|fs|vert|frag)$/,
			// use: 'raw-loader',
			use: ['raw-loader', 'glslify-loader'],
		})
		return config
	},
};

export default nextConfig;
