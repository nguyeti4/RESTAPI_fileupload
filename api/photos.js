/*
 * API sub-router for businesses collection endpoints.
 */
const multer = require('multer')
const { Router } = require('express')
const crypto = require('crypto')
const {connectToRabbitMQ, getChannel} = require('../lib/rabbitmq')
const queue = 'photos'
const fs = require('fs/promises')


const { validateAgainstSchema } = require('../lib/validation')
const {
  PhotoSchema,
  insertNewPhoto,
  getPhotoById,
  saveFileInfo,
  savePhotoFile,
} = require('../models/photo')
const { ppid } = require('process')
const express = require('express')


const router = Router()

const fileTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png'
}

const upload = multer({
  storage: multer.diskStorage({
    destination: `${__dirname}/uploads`,
    filename: function(req,file,callback){
      const ext = fileTypes[file.mimetype]
      const filename = crypto.pseudoRandomBytes(16).toString('hex')
      callback(null,`${filename}.${ext}`)
    }
  }),
  fileFilter: function(req,file,callback){
    callback(null,!!fileTypes[file.mimetype])
  }
})

/*
 * POST /photos - Route to create a new photo.
 */
router.post('/', upload.single('file'), async function(req,res,next){
  console.log("==req.file:", req.file)
  console.log("==req.body:", req.body)
  if(req.file && req.body && req.body.businessId && req.body.caption){
    try{
      const photo = {
        businessId: req.body.businessId,
        caption: req.body.caption,
        path: req.file.path,
        filename: req.file.filename,
        mimetype: req.file.mimetype
      }
      //const id = await saveFileInfo(photo)
      const id = await savePhotoFile(photo)
      await fs.unlink(req.file.path)

      const channel = getChannel()
      channel.sendToQueue(queue, Buffer.from(id.toString()))
      res.status(200).send({id: id})
    }catch(err){
      next(err)
    }
  }else{
    res.status(400).send({
      err: 'Request body needs an "image" and a "userId"'
    })
  }
})

/*
 * POST /photos - Route to create a new photo.
 */
/*
router.post('/', async (req, res) => {
  if (validateAgainstSchema(req.body, PhotoSchema)) {
    try {
      const id = await insertNewPhoto(req.body)
      res.status(201).send({
        id: id,
        links: {
          photo: `/photos/${id}`,
          business: `/businesses/${req.body.businessId}`
        }
      })
    } catch (err) {
      console.error(err)
      res.status(500).send({
        error: "Error inserting photo into DB.  Please try again later."
      })
    }
  } else {
    res.status(400).send({
      error: "Request body is not a valid photo object"
    })
  }
})
*/

/*
 * GET /photos/{id} - Route to fetch info about a specific photo.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const photo = await getPhotoById(req.params.id)
    if (photo) {
      const resBody = {
        _id: photo._id,
        url: `/media/photos/${photo._id}`,
        mimetype: photo.metadata.mimetype,
        businessId: photo.metadata.businessId,
        caption: photo.metadata.caption,
        tags: photo.metadata.tags,
        thumbId: photo.metadata.thumbId,
        thumb_url: `/media/thumbs/${photo.metadata.thumbId}`
      }
      //photo.url = `/media/photos/${photo.filename}`
      res.status(200).send(resBody)
    } else {
      next()
    }
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: "Unable to fetch photo.  Please try again later."
    })
  }
})



module.exports = router
