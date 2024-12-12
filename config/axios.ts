// https://upmostly.com/tutorials/set-up-axios-interceptors-in-your-reactjs-application
import axios from 'axios'

export const axiosInstance = axios.create({
	// baseURL: 'http://localhost:8080',
})

axiosInstance.interceptors.request.use(
	function (config) {
		// Do something before request is sent
		return config
	},
	function (error) {
		// Do something with request error
		return Promise.reject(error)
	}
)

axiosInstance.interceptors.response.use(
	function (response) {
		return response
	},
	function (error) {
		return Promise.reject(error)
	}
)
