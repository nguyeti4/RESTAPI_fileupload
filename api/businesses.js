/*
 * API sub-router for businesses collection endpoints.
 */

const { Router } = require('express')

const { validateAgainstSchema } = require('../lib/validation')
const {
  BusinessSchema,
  getBusinessesPage,
  insertNewBusiness,
  getBusinessById
} = require('../models/business')

const {
  getAllPhotosByBusinessId
} = require('../models/photo')

const router = Router()

/*
 * GET /businesses - Route to return a paginated list of businesses.
 */
router.get('/', async (req, res) => {
  try {
    /*
     * Fetch page info, generate HATEOAS links for surrounding pages and then
     * send response.
     */
    const businessPage = await getBusinessesPage(parseInt(req.query.page) || 1)
    businessPage.links = {}
    if (businessPage.page < businessPage.totalPages) {
      businessPage.links.nextPage = `/businesses?page=${businessPage.page + 1}`
      businessPage.links.lastPage = `/businesses?page=${businessPage.totalPages}`
    }
    if (businessPage.page > 1) {
      businessPage.links.prevPage = `/businesses?page=${businessPage.page - 1}`
      businessPage.links.firstPage = '/businesses?page=1'
    }
    res.status(200).send(businessPage)
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: "Error fetching businesses list.  Please try again later."
    })
  }
})

/*
 * POST /businesses - Route to create a new business.
 */
router.post('/', async (req, res) => {
  if (validateAgainstSchema(req.body, BusinessSchema)) {
    try {
      const id = await insertNewBusiness(req.body)
      res.status(201).send({
        id: id
      })
    } catch (err) {
      console.error(err)
      res.status(500).send({
        error: "Error inserting business into DB.  Please try again later."
      })
    }
  } else {
    res.status(400).send({
      error: "Request body is not a valid business object."
    })
  }
})

/*
 * GET /businesses/{id} - Route to fetch info about a specific business.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const business = await getBusinessById(req.params.id)
    const photos = await getAllPhotosByBusinessId(req.params.id)
    if (business) {  
      const resBody = {
        name: business.name,
        address: business.address,
        city: business.city,
        state: business.state,
        zip: business.zip,
        category: business.category,
        subcategory: business.subcategory,
        website: business.website,
        email: business.email,
        photos: photos
      }
       /* _id: photo._id,
        url: `/media/photos/${photo.filename}`,
        mimetype: photo.metadata.mimetype,
        businessId: photo.metadata.businessId,
        caption: photo.metadata.caption,
        tags: photo.metadata.tags}*/
      res.status(200).send(resBody)
    } else {
      next()
    }
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: "Unable to fetch business.  Please try again later."
    })
  }
})

module.exports = router
