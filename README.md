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
I think the proper assertions are in place.
