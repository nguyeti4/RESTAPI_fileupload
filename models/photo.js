/*
 * Photo schema and data accessor methods.
 */

const { ObjectId, GridFSBucket } = require('mongodb')
const fs = require('fs')
const { getDbReference } = require('../lib/mongo')
const { extractValidFields } = require('../lib/validation')
const sharp = require('sharp')
const Jimp = require('jimp')
const { image, data } = require('@tensorflow/tfjs-node')
const { info } = require('console')
const { Readable } = require('stream')

/*
 * Schema describing required/optional fields of a photo object.
 */
const PhotoSchema = {
  businessId: { required: true },
  caption: { required: false }
}
exports.PhotoSchema = PhotoSchema

/*
 * Executes a DB query to insert a new photo into the database.  Returns
 * a Promise that resolves to the ID of the newly-created photo entry.
 */
async function insertNewPhoto(photo) {
  photo = extractValidFields(photo, PhotoSchema)
  photo.businessId = ObjectId(photo.businessId)
  const db = getDbReference()
  const collection = db.collection('photos')
  const result = await collection.insertOne(photo)
  return result.insertedId
}
exports.insertNewPhoto = insertNewPhoto

/*
 * Executes a DB query to fetch a single specified photo based on its ID.
 * Returns a Promise that resolves to an object containing the requested
 * photo.  If no photo with the specified ID exists, the returned Promise
 * will resolve to null.
 */
async function getPhotoById(id) {
  const db = getDbReference()
  //const collection = db.collection('photos')
  const bucket = new GridFSBucket(db, {bucketName: 'photos'})
  if (!ObjectId.isValid(id)) {
    return null
  } else {
    const results = await bucket.find({ _id: new ObjectId(id) })
      .toArray()
    return results[0]
  }
}
exports.getPhotoById = getPhotoById

async function saveFileInfo(photo){
  const db = getDbReference()
  const collection = db.collection('photos')
  const result = await collection.insertOne(photo)
  return result.insertedId
}
exports.saveFileInfo = saveFileInfo

async function savePhotoFile (photo){
  return new Promise(function(resolve, reject){
    const db = getDbReference()
    const bucket = new GridFSBucket(db, {bucketName: 'photos'})
    const metadata = {
      businessId: photo.businessId,
      caption: photo.caption,
      mimetype: photo.mimetype
    }
    const uploadStream = bucket.openUploadStream(photo._id, 
      {metadata: metadata}
    )
    fs.createReadStream(photo.path).pipe(uploadStream)
      .on('error', function (err){
        reject(err)
      })
      .on('finish', function(result){
        console.log("===stream result:", result)
        resolve(result._id)
      })
  })
}
exports.savePhotoFile = savePhotoFile

exports.createThumb = async function(photoData, photo){
  return new Promise(function(resolve, reject){
    const db = getDbReference()
    const bucket = new GridFSBucket(db, {bucketName: 'thumbs'})
    const metadata = {
      businessId: photo.businessId,
      caption: photo.caption,
      mimetype: photo.mimetype
    }
    const uploadStream = bucket.openUploadStreamWithId(photo._id, {metadata: metadata})
    sharp(photoData)
    .resize(100,100)
    .jpeg()
    .toBuffer((err,data,info)=>{
      Readable.from(data).pipe(uploadStream)
      .on('error', function (err){
        reject(err)
      })
      .on('finish', function(result){
        console.log("===stream result 2:", result)
        resolve(result._id)
      })
    })
  })
}

/*exports.createThumb = async function(buffer, photo, id){
  Jimp.read(buffer)
    .then(image => {
      image
      .resize(256, 256) // resize
      .quality(60) // set JPEG quality
      .greyscale() // set greyscale
      return new Promise(function(resolve, reject){
        const db = getDbReference()
        const bucket = new GridFSBucket(db, {bucketName: 'thumbs'})
        const uploadStream = bucket.openUploadStream(photo.filename)
        const bucket2 = new GridFSBucket(db, {bucketName: 'photos'})
        bucket2.openDownloadStream(new ObjectId(id))
          .pipe(image)
          .pipe(uploadStream)
          .on('error', function (err){
            reject(err)
          })
          .on('finish', function(result){
            console.log("===stream result:", result)
            resolve(result._id)
          })
      })
    })
    .catch(err => {
      console.error(err);
    });
} */

exports.getPhotoInfoById = async function (id) {
  const db = getDbReference()
  const bucket = new GridFSBucket(db, { bucketName: 'photos' })
  if (!ObjectId.isValid(id)) {
    return null
  } else {
    const results = await bucket.find({ _id: new ObjectId(id) })
      .toArray()
    return results[0]
  }
}

exports.getPhotoInfoByTag = async function (tag) {
  const db = getDbReference()
  const bucket = new GridFSBucket(db, { bucketName: 'photos' })
  const results = await bucket.find({ "metadata.tags": tag })
    .toArray()
  return results[0]
}

function getImageDownloadStream (filename){
  const db = getDbReference()
  const bucket = new GridFSBucket(db, {bucketName: 'photos'})
  return bucket.openDownloadStreamByName(filename)
}
exports.getImageDownloadStream = getImageDownloadStream

exports.getDownloadStreamById = function (id) {
  const db = getDbReference()
  const bucket = new GridFSBucket(db, { bucketName: 'photos' })
  if (!ObjectId.isValid(id)) {
    return null
  } else {
    return bucket.openDownloadStream(new ObjectId(id))
  }
}

exports.getThumbDownloadStreamById = function (id) {
  const db = getDbReference()
  const bucket = new GridFSBucket(db, { bucketName: 'thumbs' })
  if (!ObjectId.isValid(id)) {
    return null
  } else {
    return bucket.openDownloadStream(new ObjectId(id))
  }
}

exports.updatePhotoTagsById = async function (id, tags) {
  const db = getDbReference()
  const collection = db.collection('photos.files')
  if (!ObjectId.isValid(id)) {
    return null
  } else {
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { "metadata.tags": tags }}
    )
    return result.matchedCount > 0
  }
}

exports.updatePhotoByThumbId = async function (id) {
  const db = getDbReference()
  const collection = db.collection('photos.files')
  if (!ObjectId.isValid(id)) {
    return null
  } else {
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { "metadata.thumbId": id }}
    )
    return result.matchedCount > 0
  }
}


async function getAllPhotosByBusinessId(id) {
  const db = getDbReference()
  //const collection = db.collection('photos')
  const bucket = new GridFSBucket(db, {bucketName: 'photos'})
  if (!ObjectId.isValid(id)) {
    return null
  } else {
    const results2 = await bucket.find({ 'metadata.businessId' : id }).toArray()
    return results2
  }
}
exports.getAllPhotosByBusinessId = getAllPhotosByBusinessId