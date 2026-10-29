// Run with `npm test`. The photos of an On-Duty punch: how many the server asks for (one, or two by HR's policy), the
// capture list and the state of the "Submit punch" button, the multipart body (photo, photo2) and what the employee
// reads when the server answers 400 PHOTO2_REQUIRED.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import {
  ON_DUTY_WEB_TRACKING_NOTE,
  PHOTO2_REQUIRED_CODE,
  PHOTO2_REQUIRED_MESSAGE,
  buildPunchForm,
  clearPhoto,
  completePhotos,
  emptyPhotoSlots,
  isPhoto2Required,
  nextEmptySlot,
  photoLabel,
  photosComplete,
  punchErrorMessage,
  punchSubmitState,
  putPhoto,
  requiredPhotoCount,
} from './onduty-photos.ts'

const jpeg = (text: string) => new Blob([text], { type: 'image/jpeg' })

/** The shape of src/api/client.ts' ApiError (the real one needs Vite's import.meta.env): message + status + body. */
class FakeApiError extends Error {
  status?: number
  data?: unknown
  constructor(message: string, status?: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

describe('requiredPhotoCount (the status reader)', () => {
  test('reads 2 from the status payload', () => {
    assert.equal(requiredPhotoCount({ requiredPhotos: 2 }), 2)
    assert.equal(requiredPhotoCount(JSON.parse('{"session":null,"punchVerifications":[],"punchSlots":[],"requiredPhotos":2}')), 2)
  })

  test('reads 1 from the status payload', () => {
    assert.equal(requiredPhotoCount({ requiredPhotos: 1 }), 1)
    assert.equal(requiredPhotoCount(JSON.parse('{"session":null,"punchVerifications":[],"requiredPhotos":1}')), 1)
  })

  test('an older server sends no requiredPhotos: 1, exactly as before', () => {
    assert.equal(requiredPhotoCount(JSON.parse('{"session":null,"punchVerifications":[],"punchSlots":[]}')), 1)
    assert.equal(requiredPhotoCount({}), 1)
    assert.equal(requiredPhotoCount(undefined), 1) // the status has not loaded
    assert.equal(requiredPhotoCount(null), 1)
  })

  test('text "2" counts, junk and nonsense numbers mean 1, a number above 2 is read as the most a punch takes', () => {
    assert.equal(requiredPhotoCount({ requiredPhotos: '2' }), 2)
    assert.equal(requiredPhotoCount({ requiredPhotos: ' 2 ' }), 2)
    assert.equal(requiredPhotoCount({ requiredPhotos: 3 }), 2)
    for (const value of [null, undefined, '', 'two', '1', 0, -1, -2, 1.5, 2.5, NaN, Infinity, true, false, [2], [], {}]) {
      assert.equal(requiredPhotoCount({ requiredPhotos: value }), 1, String(JSON.stringify(value)))
    }
  })
})

describe('photoLabel', () => {
  test('a two-photo punch names its photos "Photo 1 of 2" and "Photo 2 of 2"', () => {
    assert.equal(photoLabel(0, 2), 'Photo 1 of 2')
    assert.equal(photoLabel(1, 2), 'Photo 2 of 2')
  })

  test('a one-photo punch keeps calling it a selfie', () => {
    assert.equal(photoLabel(0, 1), 'Selfie')
    assert.equal(photoLabel(0, 0), 'Selfie')
  })
})

describe('the capture list', () => {
  test('starts with one empty slot per required photo', () => {
    assert.deepEqual(emptyPhotoSlots(1), [null])
    assert.deepEqual(emptyPhotoSlots(2), [null, null])
    assert.deepEqual(emptyPhotoSlots(0), [])
  })

  test('the camera shoots the first empty slot, in order', () => {
    let slots = emptyPhotoSlots<string>(2)
    assert.equal(nextEmptySlot(slots), 0)
    slots = putPhoto(slots, 0, 'one')
    assert.equal(nextEmptySlot(slots), 1)
    slots = putPhoto(slots, 1, 'two')
    assert.equal(nextEmptySlot(slots), null)
    assert.deepEqual(slots, ['one', 'two'])
  })

  test('Retake empties exactly that slot, and the camera goes back to it', () => {
    const full = ['one', 'two']
    const retakeFirst = clearPhoto(full, 0)
    assert.deepEqual(retakeFirst, [null, 'two'])
    assert.equal(nextEmptySlot(retakeFirst), 0)
    assert.deepEqual(putPhoto(retakeFirst, 0, 'one again'), ['one again', 'two'])
    assert.deepEqual(clearPhoto(full, 1), ['one', null])
  })

  test('never changes the list it is given; an index outside the list changes nothing', () => {
    const slots = Object.freeze(['one', null] as Array<string | null>)
    assert.deepEqual(putPhoto(slots, 1, 'two'), ['one', 'two'])
    assert.deepEqual(clearPhoto(slots, 0), [null, null])
    assert.deepEqual(slots, ['one', null])
    assert.deepEqual(putPhoto(slots, 5, 'x'), ['one', null])
    assert.deepEqual(clearPhoto(slots, -1), ['one', null])
  })

  test('is complete only when every required photo is there', () => {
    assert.equal(photosComplete([null], 1), false)
    assert.equal(photosComplete(['a'], 1), true)
    assert.equal(photosComplete(['a', null], 2), false)
    assert.equal(photosComplete([null, 'b'], 2), false)
    assert.equal(photosComplete(['a', 'b'], 2), true)
    // a list shorter or longer than the policy is not a complete punch
    assert.equal(photosComplete(['a'], 2), false)
    assert.equal(photosComplete(['a', 'b'], 1), false)
    assert.equal(photosComplete([], 0), false)
  })

  test('completePhotos hands the photos back in order, or nothing', () => {
    assert.deepEqual(completePhotos(['a', 'b'], 2), ['a', 'b'])
    assert.deepEqual(completePhotos(['a'], 1), ['a'])
    assert.equal(completePhotos(['a', null], 2), null)
    assert.equal(completePhotos(['a'], 2), null)
  })
})

describe('the "Submit punch" button', () => {
  test('two photos required: disabled with none or one, enabled with both', () => {
    assert.equal(punchSubmitState([null, null], 2).enabled, false)
    assert.equal(punchSubmitState(['a', null], 2).enabled, false)
    assert.equal(punchSubmitState([null, 'b'], 2).enabled, false)
    assert.equal(punchSubmitState(['a', 'b'], 2).enabled, true)
  })

  test('one photo required: disabled without it, enabled with it', () => {
    assert.equal(punchSubmitState([null], 1).enabled, false)
    assert.equal(punchSubmitState(['a'], 1).enabled, true)
  })

  test('a list that does not match the policy never enables it', () => {
    assert.equal(punchSubmitState(['a'], 2).enabled, false)
    assert.equal(punchSubmitState(['a', 'b'], 1).enabled, false)
    assert.equal(punchSubmitState([], 2).enabled, false)
  })

  test('stays disabled while the punch is being sent', () => {
    assert.equal(punchSubmitState(['a', 'b'], 2, true).enabled, false)
    assert.equal(punchSubmitState(['a'], 1, true).enabled, false)
  })

  test('says what is missing, and nothing when it is ready', () => {
    assert.equal(punchSubmitState([null, null], 2).hint, 'Take photo 1 of 2 to continue.')
    assert.equal(punchSubmitState(['a', null], 2).hint, 'Take photo 2 of 2 to continue.')
    assert.equal(punchSubmitState([null, 'b'], 2).hint, 'Take photo 1 of 2 to continue.')
    assert.equal(punchSubmitState(['a', 'b'], 2).hint, '')
    assert.equal(punchSubmitState([null], 1).hint, 'Take selfie to continue.')
  })

  test('a whole two-photo punch, as the dialog runs it: capture, capture, retake the first, capture, submit', () => {
    let slots = emptyPhotoSlots<string>(2)
    const states: boolean[] = [punchSubmitState(slots, 2).enabled]
    slots = putPhoto(slots, nextEmptySlot(slots) ?? -1, 'first')
    states.push(punchSubmitState(slots, 2).enabled)
    slots = putPhoto(slots, nextEmptySlot(slots) ?? -1, 'second')
    states.push(punchSubmitState(slots, 2).enabled)
    slots = clearPhoto(slots, 0) // Retake photo 1
    states.push(punchSubmitState(slots, 2).enabled)
    slots = putPhoto(slots, nextEmptySlot(slots) ?? -1, 'first, again')
    states.push(punchSubmitState(slots, 2).enabled)
    assert.deepEqual(states, [false, false, true, false, true])
    assert.deepEqual(completePhotos(slots, 2), ['first, again', 'second'])
  })
})

describe('the multipart body of POST /on-duty-sessions/punch', () => {
  const base = { latitude: 11.0168, longitude: 76.9558, accuracy: 12.5, isMocked: false, punchNumber: 2 }

  test('one photo: the field is still called photo, and there is no photo2', async () => {
    const form = buildPunchForm({ ...base, photo: jpeg('first') })
    assert.equal(form.has('photo'), true)
    assert.equal(form.has('photo2'), false)
    const photo = form.get('photo') as File
    assert.equal(photo.name, 'selfie.jpg')
    assert.equal(photo.type, 'image/jpeg')
    assert.equal(await photo.text(), 'first')
  })

  test('two photos: photo is the first, photo2 the second', async () => {
    const form = buildPunchForm({ ...base, photo: jpeg('first'), photo2: jpeg('second') })
    assert.equal(await (form.get('photo') as File).text(), 'first')
    assert.equal(await (form.get('photo2') as File).text(), 'second')
    assert.equal((form.get('photo2') as File).name, 'selfie2.jpg')
    assert.equal(form.getAll('photo').length, 1)
    assert.equal(form.getAll('photo2').length, 1)
  })

  test('a missing second photo (undefined or null) sends no photo2 field at all', () => {
    assert.equal(buildPunchForm({ ...base, photo: jpeg('a'), photo2: undefined }).has('photo2'), false)
    assert.equal(buildPunchForm({ ...base, photo: jpeg('a'), photo2: null }).has('photo2'), false)
  })

  test('by policy: the photos the capture list hands over decide whether photo2 goes out', () => {
    for (const required of [1, 2] as const) {
      const slots = ['first', 'second'].slice(0, required).map(jpeg)
      const all = completePhotos(slots, required)
      assert.ok(all, `policy ${required}`)
      const form = buildPunchForm({ ...base, photo: all[0], photo2: all[1] })
      assert.equal(form.has('photo'), true, `policy ${required}`)
      assert.equal(form.has('photo2'), required === 2, `policy ${required}`)
    }
  })

  test('the other fields are as they always were', () => {
    const form = buildPunchForm({ ...base, photo: jpeg('a'), photo2: jpeg('b') })
    assert.equal(form.get('latitude'), '11.0168')
    assert.equal(form.get('longitude'), '76.9558')
    assert.equal(form.get('accuracy'), '12.5')
    assert.equal(form.get('isMocked'), 'false')
    assert.equal(form.get('punchNumber'), '2')
    assert.deepEqual([...new Set([...form.keys()])].sort(), ['accuracy', 'isMocked', 'latitude', 'longitude', 'photo', 'photo2', 'punchNumber'])
  })

  test('accuracy and punchNumber are left out when not given; isMocked defaults to false', () => {
    const form = buildPunchForm({ latitude: 1, longitude: 2, photo: jpeg('a') })
    assert.equal(form.has('accuracy'), false)
    assert.equal(form.has('punchNumber'), false)
    assert.equal(form.get('isMocked'), 'false')
    assert.equal(buildPunchForm({ latitude: 1, longitude: 2, isMocked: true, photo: jpeg('a') }).get('isMocked'), 'true')
  })
})

describe('PHOTO2_REQUIRED', () => {
  const photo2Required = () =>
    new FakeApiError('Two photos are required: please update the app', 400, {
      code: 'PHOTO2_REQUIRED',
      error: 'Two photos are required: please update the app',
    })

  test('is a 400 whose body carries the code', () => {
    assert.equal(PHOTO2_REQUIRED_CODE, 'PHOTO2_REQUIRED')
    assert.equal(isPhoto2Required(photo2Required()), true)
    assert.equal(isPhoto2Required({ status: 400, data: { code: 'PHOTO2_REQUIRED' } }), true)
  })

  test('is not any other failure', () => {
    assert.equal(isPhoto2Required(new FakeApiError('boom', 500, { code: 'PHOTO2_REQUIRED' })), false) // wrong status
    assert.equal(isPhoto2Required(new FakeApiError('nope', 400, { code: 'PHOTO_REQUIRED' })), false) // another code
    assert.equal(isPhoto2Required(new FakeApiError('nope', 400, { error: 'Photo is required' })), false)
    assert.equal(isPhoto2Required(new FakeApiError('nope', 400, 'PHOTO2_REQUIRED')), false) // a string body
    assert.equal(isPhoto2Required(new FakeApiError('nope', 400)), false)
    assert.equal(isPhoto2Required(new FakeApiError('nope', 403, { code: 'CONSENT_REQUIRED' })), false)
    assert.equal(isPhoto2Required(new Error('PHOTO2_REQUIRED')), false)
    for (const value of [null, undefined, 'PHOTO2_REQUIRED', 400, {}, []]) assert.equal(isPhoto2Required(value), false)
  })

  test('the employee reads the clear refresh message, not the server\'s "update the app"', () => {
    const message = punchErrorMessage(photo2Required(), 'Could not submit the punch')
    assert.equal(message, PHOTO2_REQUIRED_MESSAGE)
    assert.match(message, /Two photos are now required/)
    assert.match(message, /Refresh this page/)
    assert.doesNotMatch(message, /update the app/i)
  })

  test('any other failure keeps its own sentence, else the fallback', () => {
    assert.equal(punchErrorMessage(new FakeApiError('Outside the allowed area', 400, { error: 'Outside the allowed area' }), 'x'), 'Outside the allowed area')
    assert.equal(punchErrorMessage(new Error('Network Error'), 'Could not submit the punch'), 'Network Error')
    assert.equal(punchErrorMessage(new Error(''), 'Could not submit the punch'), 'Could not submit the punch')
    assert.equal(punchErrorMessage('boom', 'Could not submit the punch'), 'Could not submit the punch')
    assert.equal(punchErrorMessage(undefined, 'Could not submit the punch'), 'Could not submit the punch')
  })
})

describe('the On-Duty request screen says where journeys are tracked', () => {
  test('one honest line: only the mobile app tracks, requests made on the web are not tracked', () => {
    assert.equal(
      ON_DUTY_WEB_TRACKING_NOTE,
      'Journey tracking runs only in the UKTextiles mobile app; requests made here are not tracked.',
    )
  })
})

describe('the page, the dialog and the API call use all of it', () => {
  const read = (path: string) =>
    readFileSync(new URL(path, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
  const page = read('../pages/employee/AttendanceRequest.tsx')
  const dialog = read('../components/employee/CameraCaptureDialog.tsx')
  const resources = read('../api/resources.ts')

  test('the page reads the policy from the status, shows the tracking line, and words PHOTO2_REQUIRED', () => {
    assert.match(page, /requiredPhotoCount\(data\)/)
    assert.match(page, /\{ON_DUTY_WEB_TRACKING_NOTE\}/)
    assert.match(page, /punchErrorMessage\(err, 'Could not submit the punch'\)/)
    assert.match(page, /total=\{photoCount\}/)
  })

  test('the page sends photo and photo2 from the complete list only', () => {
    assert.match(page, /completePhotos\(photos, photoCount\)/)
    assert.match(page, /photo: all\[0\], photo2: all\[1\]/)
  })

  test('the dialog disables "Submit punch" until every photo is there, and labels each photo', () => {
    assert.match(dialog, /punchSubmitState\(slots, total\)/)
    assert.match(dialog, /disabled=\{!submit\.enabled\}/)
    assert.match(dialog, /photoLabel\(i, total\)/)
    assert.match(dialog, /Retake/)
  })

  test('the API call builds its body with buildPunchForm', () => {
    assert.match(resources, /data: buildPunchForm\(body\)/)
    assert.doesNotMatch(resources, /form\.append\('photo'/)
  })

  test('no background tracking on the web: nothing here watches the position or beacons it', () => {
    for (const source of [page, dialog]) {
      assert.doesNotMatch(source, /watchPosition|serviceWorker|sendBeacon|setInterval|\/tracking\//)
    }
  })
})
