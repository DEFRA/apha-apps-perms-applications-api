import nock from 'nock'
import { ProxyAgent } from 'undici'

import { config } from '~/src/config/index.js'
import { provideProxy, proxyFetch } from '~/src/helpers/proxy.js'

const mockLoggerDebug = jest.fn()
jest.mock('~/src/helpers/logging/logger.js', () => ({
  createLogger: () => ({ debug: (...args) => mockLoggerDebug(...args) })
}))

const fetchSpy = jest.spyOn(global, 'fetch')
const httpProxyUrl = 'http://proxy.example.com'
const httpsProxyUrl = 'https://proxy.example.com'
const httpPort = 80
const httpsPort = 443
const statusCodeOk = 200

describe('#provideProxy', () => {
  describe('When a Proxy URL has not been set', () => {
    test('Should return null', () => {
      config.set('httpProxy', null)
      config.set('httpsProxy', null)
      expect(provideProxy()).toBeNull()
    })
  })

  describe('When a HTTP Proxy URL has been set', () => {
    let result

    beforeEach(() => {
      // @ts-expect-error TS2345
      config.set('httpProxy', httpProxyUrl)
      result = provideProxy()
    })

    test('Should make expected set up message', () => {
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        `Proxy set up using ${httpProxyUrl}:${httpPort}`
      )
    })

    test('Should set the correct port for HTTP', () => {
      expect(result).toHaveProperty('port', httpPort)
    })

    test('Should return expected HTTP Proxy object', () => {
      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('proxyAgent')
      expect(result).toHaveProperty('httpAndHttpsProxyAgent')
    })
  })

  describe('When a HTTPS Proxy URL has been set', () => {
    let result

    beforeEach(() => {
      // @ts-expect-error TS2345
      config.set('httpsProxy', httpsProxyUrl)
      result = provideProxy()
    })

    test('Should call debug with expected message', () => {
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        `Proxy set up using ${httpsProxyUrl}:${httpsPort}`
      )
    })

    test('Should set the correct port for HTTPS', () => {
      expect(result).toHaveProperty('port', httpsPort)
    })

    test('Should return expected HTTPS Proxy object', () => {
      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('proxyAgent')
      expect(result).toHaveProperty('httpAndHttpsProxyAgent')
    })
  })
})

describe('#proxyFetch', () => {
  const secureUrl = 'https://beepboopbeep.com'

  test('Should pass options through', async () => {
    config.set('httpProxy', null)
    config.set('httpsProxy', null)
    nock(secureUrl).get('/').reply(statusCodeOk, 'OK')

    await proxyFetch(secureUrl, { method: 'GET' })

    expect(fetchSpy).toHaveBeenCalledWith(secureUrl, { method: 'GET' })
  })

  describe('When no Proxy is configured', () => {
    test('Should fetch without Proxy Agent', async () => {
      config.set('httpProxy', null)
      config.set('httpsProxy', null)
      nock(secureUrl).get('/').reply(statusCodeOk, 'OK')

      await proxyFetch(secureUrl, {})

      expect(fetchSpy).toHaveBeenCalledWith(secureUrl, {})
    })
  })

  describe('When proxy is configured', () => {
    beforeEach(async () => {
      // @ts-expect-error TS2345
      config.set('httpProxy', httpsProxyUrl)
      nock(secureUrl).get('/').reply(statusCodeOk, 'OK')

      await proxyFetch(secureUrl, {})
    })

    test('Should fetch with Proxy Agent', () => {
      expect(fetchSpy).toHaveBeenCalledWith(
        secureUrl,
        expect.objectContaining({
          dispatcher: expect.any(ProxyAgent)
        })
      )
    })

    test('Should make expected set up message', () => {
      expect(mockLoggerDebug).toHaveBeenNthCalledWith(
        1,
        `Proxy set up using ${httpsProxyUrl}:${httpsPort}`
      )
    })

    test('Should make expected fetching via the proxy message', () => {
      expect(mockLoggerDebug).toHaveBeenNthCalledWith(
        2,
        `Fetching: ${secureUrl.toString()} via the proxy: ${httpsProxyUrl}:${httpsPort}`
      )
    })
  })
})