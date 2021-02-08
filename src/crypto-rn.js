// @flow
import type { CryptoBase } from './crypto'
import type { EncryptedData } from './types'
import { EncryptError, DecryptError } from './types'
import type {
  PlainDataEncodingType,
  EncryptedDataEncodingType,
  CRYPTO_ALGORITHM
} from './types'

const algorithm: CRYPTO_ALGORITHM = 'aes-256-gcm'

export type AesGcmEncryptedData = {
  iv: string,
  tag: string,
  content: string
}

export type AesGcmCryptoModule = {
  decrypt(
    base64Ciphertext: string,
    key: string,
    iv: string,
    tag: string,
    isBinary: boolean
  ): Promise<string>,
  encrypt(
    plainText: string,
    inBinary: boolean,
    key: string
  ): Promise<AesGcmEncryptedData>
}

type MD5InputEncoding = 'utf8' | 'base64'
type MD5OutputEncoding = 'hex' | 'base64'
export type MD5Module = {
  calc(
    string: string,
    inputEncoding: MD5InputEncoding,
    outputEncoding: MD5OutputEncoding
  ): string
}

export type PBKDF2Module = {
  derive(
    password: ArrayBuffer | string,
    salt: ArrayBuffer | string,
    iterations: number,
    keyLength: number
  ): Promise<ArrayBuffer>
}

export default class CryptoBaseRN implements CryptoBase {
  crypto: AesGcmCryptoModule
  md5: MD5Module
  pbkdf2: PBKDF2Module
  constructor(
    crypto: AesGcmCryptoModule,
    md5: MD5Module,
    pbkdf2: PBKDF2Module
  ) {
    this.crypto = crypto
    this.md5 = md5
    this.pbkdf2 = pbkdf2
  }

  /**
   * @returns {string} The derived key
   */
  async deriveKey(
    password: string,
    salt: string | Buffer,
    iter: number
  ): Promise<string> {
    const abSalt =
      salt instanceof Buffer ? salt.buffer : Buffer.from(salt, 'hex').buffer
    const derivation = await this.pbkdf2.derive(password, abSalt, iter, 256 / 8)
    const buffer = Buffer.from(derivation)
    return buffer.toString('base64').substring(0, 32)
  }

  calcMD5Hash(
    content: string | Buffer,
    outputEncoding: 'base64' | 'hex'
  ): string {
    return this.md5.calc(
      content instanceof Buffer ? content.toString('base64') : content,
      'base64',
      outputEncoding
    )
  }

  async encrypt(
    key: string,
    data: string | Buffer,
    opts?: {
      outputEncoding?: EncryptedDataEncodingType,
      inputEncoding?: PlainDataEncodingType
    }
  ): Promise<EncryptedData> {
    const { outputEncoding, inputEncoding } = opts || {}
    if (typeof key !== 'string') {
      throw new EncryptError('Invalid key. it must be a String')
    }

    const isBinary =
      inputEncoding === 'binary' ||
      inputEncoding === 'base64' ||
      data instanceof Buffer
    const plainData = data instanceof Buffer ? data.toString('base64') : data
    const sealed = await this.crypto.encrypt(plainData, isBinary, key)

    let encrypted
    if (typeof outputEncoding !== 'string') {
      encrypted = Buffer.from(sealed.content, 'base64')
    } else {
      if (outputEncoding === 'base64') {
        encrypted = sealed.content
      } else {
        const buf = Buffer.from(sealed.content, 'base64')
        encrypted =
          !outputEncoding || outputEncoding === 'binary'
            ? buf
            : buf.toString(outputEncoding)
      }
    }

    return {
      algorithm: algorithm,
      content: encrypted,
      iv: sealed.iv,
      tag: sealed.tag
    }
  }

  async decrypt(
    key: string,
    data: EncryptedData,
    opts: {
      outputEncoding?: PlainDataEncodingType,
      inputEncoding: EncryptedDataEncodingType
    }
  ): Promise<*> {
    const { inputEncoding, outputEncoding } = opts || {}
    if (typeof key !== 'string') {
      throw new DecryptError('Invalid key. it must be a String')
    }
    if (typeof data !== 'object') {
      throw new DecryptError('Invalid data, it must be an Object')
    }

    const isBinary = !outputEncoding || outputEncoding === 'binary'
    let ciphertext: string
    if (data.content instanceof Buffer) {
      ciphertext = data.content.toString('base64')
    } else if (inputEncoding === 'base64') {
      ciphertext = data.content
    } else if (typeof inputEncoding === 'string') {
      ciphertext = Buffer.from(data.content, inputEncoding).toString('base64')
    } else {
      throw new DecryptError('Invalid data, it must be an Object')
    }
    const unsealed = await this.crypto.decrypt(
      ciphertext,
      key,
      data.iv,
      data.tag,
      isBinary
    )

    const decrypted = isBinary ? Buffer.from(unsealed, 'base64') : unsealed
    return decrypted
  }
}
