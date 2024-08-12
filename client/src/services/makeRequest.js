import axios from "axios"

const api = axios.create({
    baseURL: process.env.REACT_APP_SERVER_URL,
    withCredentials: true
})

export function makeRequest(url, options) {
  console.log(`Requesting URL: ${api.defaults.baseURL}${url}`, options);
  return api(url, options)
    .then(res => {
      console.log(`Response for ${url}:`, res.data);
      return res.data;
    })
    .catch(error => {
      console.error(`Error in request to ${url}:`, {
        message: error?.response?.data?.message,
        status: error?.response?.status,
        data: options?.data,
      });
      return Promise.reject(error?.response?.data?.message ?? "Error");
    });
}
