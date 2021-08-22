import axios, { AxiosError } from 'axios';
import { parseCookies, setCookie } from 'nookies'

let cookies = parseCookies();
let isRefreshing = false;
let failedRequestsQueue: { onSuccess: (token: string) => void; onFailuere: (err: AxiosError<any>) => void; }[] = [];

export const api = axios.create({
  baseURL: 'http://localhost:3333',
  headers: {
    Authorization: `Bearer ${cookies['authnext.token']}`
  }
});

api.interceptors.response.use(response => {
  return response;
}, (error: AxiosError) => {
  if(error.response.status === 401) {
    if (error.response.data?.code === 'token.expired') {
      cookies = parseCookies();

      const { 'authnext.refreshToken': refreshToken } = cookies;
      const originalConfig = error.config

      if (!isRefreshing) {
        isRefreshing = true;
        
        api.post('/refresh', {
          refreshToken,
        }).then(response => {
          const { token } = response.data;
  
          setCookie(undefined, 'authnext.token', token, {
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/'
          })
    
          setCookie(undefined, 'authnext.refreshToken', response.data.refreshToken, {
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/'
          })
  
          api.defaults.headers['Authorization'] = `Bearer ${token}`;

          failedRequestsQueue.forEach(request => request.onSuccess(token))
          failedRequestsQueue = [];
        }).catch(err => {
          failedRequestsQueue.forEach(request => request.onFailuere(err))
          failedRequestsQueue = [];
        }).finally(() => {
          isRefreshing = false
        });
      }

      return new Promise((resolve, reject) => {
        failedRequestsQueue.push({
          onSuccess: (token: string) => {
            originalConfig.headers['Authorization'] = `Bearer ${token}`

            resolve(api(originalConfig))
          },
          onFailuere: (err: AxiosError) => {
            reject(err)
          }
        })
      })
    } else {
      // deslogar o usuario
    }
  }
})