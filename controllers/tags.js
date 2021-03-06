var TagForm    = require('../forms/tag')
  , Post       = require('../models/post').Post
  , PostTag       = require('../models/post_tag').PostTag
  , Tag        = require('../models/tag').Tag
  , middleware = require('../utils/middleware');

var blockNAUser = middleware.blockNonAuthenticatedUser
  , loadUser = middleware.loadUser;


module.exports = function (app) {

  /**
   * タグの保存
   */

  app.post('/tags/create', loadUser, blockNAUser, TagForm.create, function (req, res) {
    if (req.form.isValid) {
      Post.findById(req.form.post_id, function (err, post) {
        if (post.tagNames.length < 10) {
          var lowerTagName = req.form.name.toLowerCase();

          Tag.findOne({ lowerName: lowerTagName }, function (err, tag) {
            if (tag) {
              post.addTag(tag, function (err) {
                if (!err) {
                    res.send({ tag: tag });
                } else {
                  res.send({ errors: [err.message] }, 403);
                }
              });
            } else {
              var tag = new Tag({ name: req.form.name, lowerName: req.form.name });
              
              tag.save(function (err) {
                if (!err) {
                  post.addTag(tag, function (err) {
                    if (!err) {
                      res.send({ tag: tag });
                    }
                  });
                } else {
                  res.send({ errors: [err] }, 403);
                }
              });
            }
          });
        } else {
          res.send({ errors: ['これ以上タグを追加できません'] }, 403);
        }
      });
    } else {
      res.send({ errors: req.form.errors }, 403);
    }
  });
  
  /**
   * タグの削除
   */

  app.del('/tags/:name', loadUser, blockNAUser, function (req, res) {
    var lowerTagName = req.params.name.toLowerCase()
      , postId = req.body.postId;

    Tag.findOne({ lowerName: lowerTagName }, function (err, tag) {
      if (tag) {
        PostTag.remove({ post: postId, tag: tag.id }, function (err) {
          Post.findById(postId, function (err, post) {
            post.tagNames.splice(post.tagNames.indexOf(tag.name), 1);
            post.save(function () {
              res.send(200);
            });
          });
        });
      } else {
        res.send(400);
      }
    });
  });

  /**
   * 個別のページ
   */

  app.get('/t/:name', loadUser, function (req, res) {
    var lowerTagName = req.params.name.toLowerCase();

    Tag.findOne({ lowerName: lowerTagName }, function (err, tag) {
      if (tag) {
        res.render('tags/show', {
            title: tag.name
          , user: req.user
          , tag: tag
          , csrfToken: req.session._csrf
        });
      } else {
        res.send(404);
      }
    });
  });
};
