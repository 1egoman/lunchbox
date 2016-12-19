# Lunchbox

A system for managing my grocery list and onhand food. I've tried to build this
app a number of times:
- https://github.com/1egoman/cena
- https://github.com/1egoman/cena2
- https://github.com/1egoman/cena_app
- https://github.com/1egoman/bag-node
- https://github.com/1egoman/bag-cloud
- And now, this one!

# Deploying backend to production
This app lives on heroku at `https://lunch-box.herokuapp.com/v1`. All that's
required is to `git push heroku master`. However, that means that:
- Both `SECRET_KEY` and `MONGODB_URI` have been set. There's more too, see the `Biomefile`.
- A mongodb instance exists for this app.

## Technical details
Mostly just a CRUD server with token auth. User's can upload images and they are
stored in GridFS within mongodb (that's actually not bad practice from what I've
found online). Both `Items` and `Lists` share the same schema because mongoose
`populate` won't work cross-schema. Not sure how I feel about that long term but
I think the proper assertions are in place. Also, I've attempted to use
dependency inject to try and eliminate mocking `require` when testing. Each test
makes a new router instance, attaches that to a mock express server, and then
`supertest` is used to manage routes.

## Routes
- `GET /v1/items`: Get all items and lists.
- `GET /v1/items/:id`: Get a given item or list by id.
- `POST /v1/items`: Create a new item or list. The body is shoved into the document as a starting point, so pass (ie) `{"type": "item", "name": "My item"}` to create an item, etc...
- `PUT /v1/items/:id`: Update the given item or list with the passed body. Acts like a patch.
- `DELETE /v1/items/:id`: Delete the given item or list.
- `GET /v1/items/:id/image`: Get the image associated with the item. Returns a
  png thats (by default) 54px by 54px.
- `POST /v1/items/:id/image`: Upload a new image. The body is an image blob.
- `GET /v1/items/search`: not used by frontend atm, search through item and list
  names with a phrase. Could be used for fuzzy searching.

- `GET /v1/lists/grocery`: like `GET /v1/items/:id` only gets the grocery list.
- `GET /v1/lists/pantry`: like `GET /v1/items/:id` only gets the pantry.
- `POST /v1/lists/:id/contents`: Add the item specified in the body. Body looks
  like: `{"item": "item id to add", "quantity": "quantity of item to add"}`.
- `DELETE /v1/lists/:id/contents/:childId`: Remove item with id `childId` from
  the list with the given id.
