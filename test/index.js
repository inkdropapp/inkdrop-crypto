// @flow
import createEncryptHelperForNode from '../src'
import test from 'ava'

global.require = require

const imageDataBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAZ5JREFUeNrEVottgzAQJRPQDUgnoBu4nYBu4GyQbuBuQDcgG6QbkE5AMwHZgHYCepbOlWX5d9gQS09CYHznu3t3ryjSVg1gxR1XDxjuZbwBzAi+9JBdggMj4AL4ARwAe8DvVrcXgAlQAUp8FlsZrywGj5iKagsHOgx/aUnJeW3jDG/aeL6xtWnXB76PaxnneMM6UB8z1kRWGsp8fwNugPfA3jfAc25aCq3pxKLNSbvZwnPu6YQiJy3PlsJSzadFTGvR0kUtoRl1dcIstBwstFMp6fBwhs+2kCdNS+451FV4LmfJ01LPcWxYXd9cNeJdSwsrVLAk2pndLGbipfzrLRzKzBeO6A2BOfK/bOFqCZRijk6o0kpSO0r5zviuj4zgZAyuiqKaSiykzkgJi6AU1yKlh9wlYoKK1wy97yDTcWac0VDHcY9jVY7gE757wHH7ieNZX0+AV8AHKuVCU8tSPb9QHag1DXBb2E33COncNacApXTTLmUYpWh+saQF+9QQRVxEa8NYTThiHVwi9ytN+JjLARYhRs0l93+FNv0JMADG1qTgmYgmzwAAAABJRU5ErkJggg=='
const imageDataBuffer = Buffer.from(imageDataBase64, 'base64')
const iter = 100000

test.serial('check exports', t => {
  t.is(typeof createEncryptHelperForNode, 'function')
})

test.serial('generating encryption key', async t => {
  const mod = createEncryptHelperForNode()
  const keyMasked = await mod.createEncryptionKey('foo', iter)
  t.log('masked key:', keyMasked)
  t.is(keyMasked.algorithm, 'aes-256-gcm')
  t.is(typeof keyMasked.content, 'string')
  t.is(typeof keyMasked.iv, 'string')
  t.is(typeof keyMasked.tag, 'string')
  t.is(typeof keyMasked.salt, 'string')
  t.is(typeof keyMasked.iterations, 'number')

  const key = await mod.revealEncryptionKey('foo', keyMasked)
  t.log('unmasked key:', key)
  t.is(typeof key, 'string')
})

test.serial('updating encryption key', async t => {
  const mod = createEncryptHelperForNode()
  const keyMasked = await mod.createEncryptionKey('foo', iter)

  const keyUpdated = await mod.updateEncryptionKey(
    'foo',
    'bar',
    iter,
    keyMasked
  )
  t.is(keyUpdated.algorithm, 'aes-256-gcm')
  t.is(typeof keyUpdated.content, 'string')
  t.is(typeof keyUpdated.iv, 'string')
  t.is(typeof keyUpdated.tag, 'string')
  t.is(typeof keyUpdated.salt, 'string')
  t.is(typeof keyUpdated.iterations, 'number')
  t.is(keyMasked.content !== keyUpdated.content, true)
  t.is(keyMasked.iv !== keyUpdated.iv, true)
  t.is(keyMasked.tag !== keyUpdated.tag, true)
  t.is(keyMasked.salt === keyUpdated.salt, true)

  const key = await mod.revealEncryptionKey('bar', keyUpdated)
  t.is(typeof key, 'string')
})

test.serial('encrypt & decrypt note', async t => {
  const mod = createEncryptHelperForNode()
  const pass = 'foo'
  const keyMasked = await mod.createEncryptionKey(pass, iter)
  const key = await mod.revealEncryptionKey(pass, keyMasked)
  const note = {
    _id: 'note:test',
    title: 'title',
    body: '# This is markdown',
    bookId: 'book:test',
    tags: [],
    createdAt: +new Date(),
    updatedAt: +new Date()
  }
  const noteEnc = await mod.encryptDoc(key, { ...note })

  t.log('Encrypted note:', noteEnc)
  t.is(typeof noteEnc.encryptedData, 'object')
  t.is(typeof noteEnc.encryptedData.algorithm, 'string')
  t.is(typeof noteEnc.encryptedData.content, 'string')
  t.is(typeof noteEnc.encryptedData.iv, 'string')
  t.is(typeof noteEnc.encryptedData.tag, 'string')
  t.is(noteEnc.title, undefined)
  t.is(noteEnc.body, undefined)

  const noteDec = await mod.decryptDoc(key, { ...noteEnc })
  t.is(noteDec._id, note._id)
  t.is(noteDec.title, note.title)
  t.is(noteDec.body, note.body)
  t.is(noteDec.bookId, note.bookId)
})

test.serial('encrypt & decrypt attachment', async t => {
  const mod = createEncryptHelperForNode()
  const pass = 'foo'
  const keyMasked = await mod.createEncryptionKey(pass, iter)
  const key = await mod.revealEncryptionKey(pass, keyMasked)
  const file = {
    _id: 'file:test',
    name: 'test.png',
    contentType: 'image/png',
    contentLength: imageDataBuffer.length,
    createdAt: +new Date(),
    publicIn: [],
    _attachments: {
      index: {
        content_type: 'image/png',
        data: imageDataBase64
      }
    }
  }
  const plainData = file._attachments.index.data
  const fileEnc = await mod.encryptFile(key, { ...file })

  t.log('Encrypted file:', fileEnc)
  t.is(typeof fileEnc._attachments.index.data, 'string')
  t.is(
    fileEnc._attachments.index.content_type,
    'application/aes-256-gcm-encrypted'
  )
  t.is(typeof fileEnc._attachments.index.length, 'number')
  t.is(typeof fileEnc._attachments.index.digest, 'string')
  t.is(typeof fileEnc._attachments.index.data, 'string')
  t.is(typeof fileEnc.encryptionData, 'object')
  t.is(typeof fileEnc.encryptionData.algorithm, 'string')
  t.is(typeof fileEnc.encryptionData.iv, 'string')
  t.is(typeof fileEnc.encryptionData.tag, 'string')

  const fileDec = await mod.decryptFile(key, { ...fileEnc })
  t.is(fileDec._id, file._id)
  t.is(fileDec.name, file.name)
  t.is(fileDec._attachments.index.data, plainData)
  t.is(
    fileDec._attachments.index.content_type,
    file._attachments.index.content_type
  )
  t.is(fileDec._attachments.index.length, file.contentLength)
  t.is(typeof fileDec._attachments.index.length, 'number')
  t.is(typeof fileDec._attachments.index.digest, 'string')
  t.log('Decrypted file:', fileDec)
})
