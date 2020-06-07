const http = require('http')
const path = require('path')
const fse = require('fs-extra')
const Busboy = require('busboy')
const Multiparty = require('multiparty')

const server = http.createServer()
const UPLOAD_DIR = path.resolve(__dirname, 'files')

server.on('request', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') {
    res.status = 200
    res.end()
  } else if (req.url === '/verify') {
    controller.handleVerifyUpload(req, res)
  } else if (req.url === '/') {
    controller.handleUploadWithMultiparty(req, res)
    // controller.handleUploadWithBusboy2(req, res)
  } else if (req.url === '/merge') {
    controller.handleMerge(req, res)
  } else {
    res.status = 404
    res.end()
  }
})

server.listen(3333, () => console.log('start listening to 3333'))

const controller = {
  async handleVerifyUpload(req, res) {
    // 文件在服务器是以 hash 存储的，感觉直接传 hash + ext 也可以
    const { fileName, hash } = JSON.parse(await readFromStream(req))
    const ext = path.extname(fileName)
    const newFileName = hash + ext
    const filePath = path.resolve(UPLOAD_DIR, newFileName)
    if (fse.existsSync(filePath)) {
      res.end(JSON.stringify({ uploaded: true }))
    } else {
      const uploadedChunks = await getUploadedChunks(hash)
      res.end(JSON.stringify({ uploaded: false, uploadedChunks }))
    }
  },
  async handleUploadWithMultiparty(req, res) {
    const form = new Multiparty.Form()

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(err)
        res.status = 500
        res.end('process file chunk failed')
        return
      }
      const [chunk] = files.chunk
      const [hash] = fields.hash
      const [index] = fields.index
      const [fileName] = fields.fileName
      const ext = path.extname(fileName)
      const filePath = path.resolve(UPLOAD_DIR, `${hash}${ext}`)

      // 文件存在直接返回
      if (fse.existsSync(filePath)) {
        res.end('file exist')
        return
      }

      const chunkDir = path.resolve(UPLOAD_DIR, hash)
      const chunkPath = path.resolve(chunkDir, index)
      console.log('chunk', chunk.size)
      await fse.move(chunk.path, chunkPath)
      res.end('received file chunk')
    })
  },
  // FIXME: 文件大小不对
  async handleUploadWithBusboy(req, res) {
    const busboy = new Busboy({ headers: req.headers })
    const data = {}
    busboy.on('file', async (fieldname, file) => {
      // 这里不 read 就不会 finish
      data[fieldname] = readFromStream(file)
    })
    busboy.on('field', (fieldname, val) => {
      console.log('field', fieldname, val)
      data[fieldname] = val
    })
    busboy.on('finish', async () => {
      const { hash, chunk, index, fileName } = data
      const ext = path.extname(fileName)
      // 源文件已存在，chunk 不必保存
      const filePath = path.resolve(UPLOAD_DIR, hash + ext)
      if (fse.existsSync(filePath)) {
        res.end('file exist')
      } else {
        const chunkDir = path.resolve(UPLOAD_DIR, hash)
        const data = await chunk
        console.log('data', data.length)
        // 这个接近了，问题似乎是 read 的时候有损耗
        await fse.outputFile(path.resolve(chunkDir, index), data, {
          encoding: 'binary',
        })
        res.end('chunk received')
      }
    })
    req.pipe(busboy)
  },
  // FIXME: 有些 field 会卡着读不出来
  async handleUploadWithBusboy2(req, res) {
    const busboy = new Busboy({ headers: req.headers })
    const data = {}
    busboy.on('file', async (fieldname, val) => {
      data[fieldname] = val
      tryWriteChunk()
    })
    busboy.on('field', (fieldname, val) => {
      console.log('field', fieldname, val)
      data[fieldname] = val
      tryWriteChunk()
    })
    async function tryWriteChunk() {
      if (['hash', 'chunk', 'index', 'fileName'].some((k) => !(k in data)))
        return
      // console.log(Object.keys(data))
      const { hash, chunk, index, fileName } = data
      const ext = path.extname(fileName)
      // 源文件已存在，chunk 不必保存
      const filePath = path.resolve(UPLOAD_DIR, hash + ext)
      if (fse.existsSync(filePath)) {
        res.end('file exist')
      } else {
        const chunkDir = path.resolve(UPLOAD_DIR, hash)
        const chunkPath = path.resolve(chunkDir, index)
        fse.ensureFileSync(chunkPath)
        chunk.pipe(fse.createWriteStream(chunkPath))
        res.end('chunk received')
      }
    }
    req.pipe(busboy)
  },
  async handleMerge(req, res) {
    // TODO: chunkSize 在本地获取
    const { fileName, hash, chunkSize } = JSON.parse(await readFromStream(req))
    const chunkDir = path.resolve(UPLOAD_DIR, hash)
    const chunkNames = await fse.readdir(chunkDir)
    chunkNames.sort((a, b) => a - b)
    const ext = path.extname(fileName)
    const filePath = path.resolve(UPLOAD_DIR, hash + ext)
    await Promise.all(
      chunkNames.map(
        (name, i) =>
          new Promise((resolve) => {
            const chunkPath = path.resolve(chunkDir, name)
            const readStream = fse.createReadStream(chunkPath)
            readStream.on('end', () => {
              fse.unlinkSync(chunkPath)
              resolve()
            })
            const writeStream = fse.createWriteStream(filePath, {
              start: i * chunkSize,
              end: (i + 1) * chunkSize,
            })
            readStream.pipe(writeStream)
          }),
      ),
    )
    fse.rmdirSync(chunkDir)
    res.end(
      JSON.stringify({
        code: 0,
        message: 'file merged success',
      }),
    )
  },
}

function readFromStream(stream) {
  return new Promise((resolve) => {
    let result = ''
    stream.on('data', (d) => (result += d))
    stream.on('end', () => resolve(result))
  })
}

async function getUploadedChunks(hash) {
  const chunksPath = path.resolve(UPLOAD_DIR, hash)
  if (fse.existsSync(chunksPath)) {
    return await fse.readdir(chunksPath)
  } else {
    return []
  }
}
