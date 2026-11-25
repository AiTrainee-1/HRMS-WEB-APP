// Run with `npm test`. The "location is off / blocked" popup's rules (lib/location-off.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { LocationError, detectPlatform, locationOffCopy, locationProblemOf, problemFromCode, problemMessage, showsPopup } from './location-off.ts'

const UA = {
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:132.0) Gecko/20100101 Firefox/132.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
}

describe('what went wrong', () => {
  test('geolocation codes', () => {
    assert.equal(problemFromCode(1), 'blocked')
    assert.equal(problemFromCode(2), 'unavailable')
    assert.equal(problemFromCode(3), 'timeout')
    assert.equal(problemFromCode(undefined), 'unavailable')
  })
  test('from our error, a raw position error, or nothing', () => {
    assert.equal(locationProblemOf(new LocationError('blocked', 'x')), 'blocked')
    assert.equal(locationProblemOf({ code: 1, PERMISSION_DENIED: 1, message: '' }), 'blocked')
    assert.equal(locationProblemOf({ problem: 'insecure' }), 'insecure')
    assert.equal(locationProblemOf(new Error('Network Error')), null)
    assert.equal(locationProblemOf(null), null)
  })
  test('the popup is for blocked / off / unsupported, not a slow fix', () => {
    assert.equal(showsPopup('blocked'), true)
    assert.equal(showsPopup('unavailable'), true)
    assert.equal(showsPopup('unsupported'), true)
    assert.equal(showsPopup('timeout'), false)
    assert.equal(showsPopup(null), false)
    assert.match(problemMessage('blocked'), /blocked/)
    assert.match(problemMessage('timeout'), /too long/)
  })
})

describe('the words for each device', () => {
  test('browser and device', () => {
    assert.deepEqual(detectPlatform(UA.chromeWin), { browser: 'chrome', device: 'windows' })
    assert.deepEqual(detectPlatform(UA.edgeWin), { browser: 'edge', device: 'windows' })
    assert.deepEqual(detectPlatform(UA.chromeAndroid), { browser: 'chrome', device: 'android' })
    assert.deepEqual(detectPlatform(UA.samsung), { browser: 'samsung', device: 'android' })
    assert.deepEqual(detectPlatform(UA.safariIphone), { browser: 'safari', device: 'ios' })
    assert.deepEqual(detectPlatform(UA.chromeIphone), { browser: 'chrome', device: 'ios' })
    assert.deepEqual(detectPlatform(UA.firefoxMac), { browser: 'firefox', device: 'mac' })
    assert.deepEqual(detectPlatform(UA.safariMac), { browser: 'safari', device: 'mac' })
    assert.deepEqual(detectPlatform(''), { browser: 'other', device: 'other' })
  })
  test('blocked: the site-permission steps of that browser, ending with Try again', () => {
    const chrome = locationOffCopy('blocked', 'punch', UA.chromeWin)
    assert.equal(chrome.title, 'Location is blocked')
    assert.match(chrome.body, /at your branch/)
    assert.match(chrome.steps[0], /address bar/)
    assert.match(chrome.steps[chrome.steps.length - 1], /Try again/)
    assert.match(locationOffCopy('blocked', 'general', UA.firefoxMac).steps.join(' '), /Access your location/)
    assert.match(locationOffCopy('blocked', 'general', UA.safariIphone).steps.join(' '), /Website Settings/)
    assert.match(locationOffCopy('blocked', 'general', UA.chromeIphone).steps.join(' '), /While Using/)
  })
  test('off: the device steps', () => {
    assert.match(locationOffCopy('unavailable', 'on_duty', UA.chromeAndroid).steps[0], /Swipe down/)
    assert.match(locationOffCopy('unavailable', 'on_duty', UA.chromeAndroid).body, /On-Duty/)
    assert.match(locationOffCopy('unavailable', 'punch', UA.edgeWin).steps.join(' '), /Windows Settings/)
    assert.match(locationOffCopy('unavailable', 'punch', UA.safariMac).steps.join(' '), /System Settings/)
    assert.equal(locationOffCopy('unavailable').stamp, 'LOCATION OFF')
    assert.equal(locationOffCopy('insecure').title, 'Use the secure address')
    assert.equal(locationOffCopy('unsupported').stamp, 'NO GPS')
  })
})
