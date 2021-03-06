define(function (require) {
  var CommentCollection = require('../collections/comment')
    , PostCollection    = require('../collections/post')
    , CommentModel      = require('../models/comment').Comment
    , PostModel         = require('../models/post')
    , TagModel          = require('../models/tag').Tag
    , doc               = require('../utils/doc')
    , string            = require('../utils/string');


  /**
   * つぶやきを入力するフォーム
   */

  PostFormView = Backbone.View.extend({
    el: 'form',

    events: {
        'focusin #post': 'handlePostFormOnFocusin'
      , 'focusout #post': 'handlePostFormOnFocusout'
      , 'keydown #post': 'handlePostFormByKeyboard'
      , 'click #create': 'create'
    },

    initialize: function (options) {
      var self = this;

      this.socket = options.socket;

      this.socket.on('showPost', function (post) {
        self.renderPost(post);
      });
    },

    create: function (e) {
      e.preventDefault();
      
      //$('form button').addClass('disabled');
      
      var self = this
        , csrf = $('.csrf').val()
        , tagLowerName = $('#tag-lower-name').val()
        , post = $('#post').val();

      this.model.url = '/posts/create';

      this.model.save({ _csrf: csrf, post: post, tagLowerName: tagLowerName }, {
        success: function (model, response) {
          var post = response.post;

          self.socket.emit('createPost', post);

          $('form button').removeClass('disabled');
          $('textarea#post').val('');
          self.renderPost(post);
        }
      });
    },

    renderPost: function (post) {
      var convertedPost = doc.convert(post);

      $('#showPostsTmpl').tmpl(convertedPost, { userId: Anoside.user.id }).prependTo('.post-component');
    },

    /**
     * 入力フォームにフォーカルが移ったとき
     */

    handlePostFormOnFocusin: function () {
      var textareaElm = $('textarea#post');
      
      // エンターキーの押下によって入力フォームが
      // 高くなっていないときだけ入力フォームを少し高くする
      if (textareaElm.css('height') === '16px') {
        textareaElm.css('height', '50px');
      }

      // フォームのTipsを表示する
      $('#form-tips').fadeIn();
    },

    /**
     * 入力フォームの外にフォーカスが移ったとき
     */

    handlePostFormOnFocusout: function () {
      // 入力フォームの高さを元に戻す
      $('textarea#post').css('height', '16px');

      $('#form-tips').fadeOut();
    },
    
    /**
     * 入力フォーム内でのキーボードイベントを処理する
     */

    handlePostFormByKeyboard: function (e) {
      var textareaElm = $('textarea#post');
      
      // 入力フォームでエンターキーが押されたら、
      // 入力フォームを下に広げる
      // (shiftキーが同時に押されたときは投稿される)
      if (e.keyCode === 13 && e.shiftKey === false) {
        textareaElm.css('height', '120px');
      }

      // 何も入力されてないか、改行だけされてるときに
      // escキーが押されたら、入力フォームへのフォーカスが移ったときの処理をする
      if (e.keyCode === 27 && (textareaElm.val() === '' || textareaElm.val() === '\n')) {
        this.handleFormOnFocusout();
      }

      // shift+enterでポストされる
      if (e.keyCode === 13 && e.shiftKey === true) {
        this.create(e);
      }
    }
  });

  /**
   * ポスト一つ一つのビュー
   */

  var PostView = Backbone.View.extend({
    el: '.post-component',

    events: {
        'mouseover .post': 'showMenu'
      , 'mouseout .post': 'hideMenu'
      , 'click .delete-post': 'deletePost'
      , 'click .new-comment': 'newComment'
      , 'keydown .new-comment .body': 'handleCommentFormByKeyboard'
      , 'click button.create-comment': 'createComment'
      , 'click .new-comment .cancel': 'hideNewCommentForm'
      , 'click .comments-count:not(.opened)': 'showComments'
      , 'click .comments-count.opened': 'closeComments'
      , 'click .new-tag': 'newTag'
      , 'keydown .new-tag .name': 'handleTagFormByKeyboard'
      , 'click button.create-tag': 'createTag'
      , 'click .new-tag .cancel': 'hideNewTagForm'
      , 'mouseover .tag-name': 'showTagMenu'
      , 'mouseout .tag-name': 'hideTagMenu'
      , 'click span.delete': 'deleteTag'
    },

    initialize: function (options) {
      var self = this;

      // 子クラスから渡されたsocketオブジェクトをthisに代入
      self.socket = options.socket;

      self.socket.on('deletePost', function (data) {
        $('.post-component [data-post-id=' + data.postId + ']').remove();
      });

      self.socket.on('showComment', function (comment) {
        var commentsElm = $('.post-component [data-post-id=' + comment.post + '] ul.comments');
        self.renderComment(comment, commentsElm);
      });

      self.socket.on('showTag', function (tag) {
        var tagsElm = $('.post-component [data-post-id=' + tag.postId + '] .tags');
        self.renderTag(tag, tagsElm);
      });

      self.socket.on('deleteTag', function (data) {
        $('.post-component [data-post-id=' + data.postId + '] .tags [data-tag-name=' + data.tagName + ']').remove();
      });
    },

    render: function () {
      var posts = this.collection.toJSON()
        , convertedPosts = posts.map(function (post) { return doc.convert(post) });

      $('#showPostsTmpl').tmpl(convertedPosts, { userId: Anoside.user.id }).appendTo('.post-component');
    },

    showMenu: function (e) {
      $(e.currentTarget).children('.footer').children('.menu').css('display', 'inline');
    },

    hideMenu: function (e) {
      $(e.currentTarget).children('.footer').children('.menu').css('display', 'none');
    },

    deletePost: function (e) {
      if (confirm('削除しますか?')) {
        var self = this
          , csrf = $('.csrf').val()
          , postElm = $(e.currentTarget).parents('.post')
          , postId = postElm.attr('data-post-id');
        
        $.ajax({
          url: '/posts/' + postId,
          type: 'DELETE',
          data: { _csrf: csrf, postId: postId },
          success: function () {
            self.socket.emit('deletePost', { postId: postId });
            postElm.remove();
          }
        });
      }
    },

    newComment: function (e) {
      var postElm = $(e.currentTarget).parents('.post');

      if (postElm.find('div.new-comment').length === 0) {
        $('#newCommentFormTmpl').tmpl().appendTo(postElm);
      }
    },

    handleCommentFormByKeyboard: function (e) {
      // shift+enterでポストされる
      if (e.keyCode === 13 && e.shiftKey === true) {
        this.createComment(e);
      }
    },

    createComment: function (e) {
      var self = this
        , currentElm = $(e.currentTarget)
        , postId = currentElm.parents('.post').attr('data-post-id')
        , csrf = currentElm.siblings('.csrf').val()
        , body = currentElm.siblings('.body').andSelf().val()
        , comment = new CommentModel();

      comment.url = '/comments/create';

      comment.save({ _csrf: csrf, body: body, post_id: postId }, {
        success: function (model, response) {
          var comment = response.comment
            , commentsElm = currentElm.parent().siblings('ul.comments');

          self.socket.emit('createComment', comment);

          currentElm.parent('.new-comment').remove();
          self.renderComment(comment, commentsElm);
        }
      });
    },

    renderComment: function (comment, commentsElm) {
      var convertedComment = doc.convert(comment);

      $('#showCommentsTmpl').tmpl(convertedComment).appendTo(commentsElm);
    },

    hideNewCommentForm: function (e) {
      //console.log($(e.currentTarget));
      $(e.currentTarget).parent('.new-comment').remove();
    },

    showComments: function (e) {
      var postId = $(e.currentTarget).parents('.post').attr('data-post-id')
        , commentsUlElm = $(e.currentTarget).parent().siblings('ul.comments');

      // 「nコメント」リンクをクリックしてコメントを表示していることを示す値をクラスに付加する
      $(e.currentTarget).addClass('opened');

      // すでに表示されているコメントを全て消す
      if (commentsUlElm.children().length !== 0) {
        commentsUlElm.children().remove();
      }

      // closeComments()が呼び出されたあとに付加されたdisplay: noneを除去する
      if (commentsUlElm.css('display') === 'none') {
        commentsUlElm.css('display', '');
      }

      this.collection = new CommentCollection.Comments(null, postId);
      this.collection.fetch({
        success: function (collection, response) {
          var convertedComments = response.map(function (comment) { return doc.convert(comment) });

          $('#showCommentsTmpl').tmpl(convertedComments).appendTo(commentsUlElm);
        }
      });
    },

    closeComments: function (e) {
      $(e.currentTarget).parent().siblings('ul.comments').css('display', 'none');
      $(e.currentTarget).removeClass('opened');
    },

    newTag: function (e) {
      var postElm = $(e.currentTarget).parents('.post');

      if (postElm.find('div.new-tag').length === 0) {
        $('#newTagFormTmpl').tmpl().appendTo(postElm);
      }
    },

    handleTagFormByKeyboard: function (e) {
      // shift+enterでポストされる
      if (e.keyCode === 13 && e.shiftKey === true) {
        this.createTag(e);
      }
    },

    createTag: function (e) {
      var self = this
        , currentElm = $(e.currentTarget)
        , postId = currentElm.parents('.post').attr('data-post-id')
        , csrf = currentElm.siblings('.csrf').val()
        , tagName = currentElm.siblings('.name').andSelf().val()
        , tag = new TagModel();

      tag.url = '/tags/create';

      tag.save({ _csrf: csrf, name: tagName, post_id: postId }, {
        success: function (model, response) {
          var tag = response.tag
            , tagsElm = currentElm.parent().siblings('.tags');

          self.socket.emit('createTag', _.extend(tag, { postId: postId }));

          currentElm.parent('.new-tag').remove();
          self.renderTag(tag, tagsElm);
        },

        error: function (data, response) {
          var errorMessage = response.responseText;

          if (errorMessage !== 'Forbidden') { // 単にres.send(403)するとForbiddenという文字列が返る
            $('ul.errors').children().remove();
            $('#showErrors').tmpl(JSON.parse(errorMessage))
              .appendTo(currentElm.siblings('ul.errors')).delay(1000).fadeOut();
          }
        }
      });
    },

    renderTag: function (tag, tagsElm) {
      $('#showTagsTmpl').tmpl(tag).appendTo(tagsElm);
    },

    hideNewTagForm: function (e) {
      $(e.currentTarget).parent('.new-tag').remove();
    },

    showTagMenu: function (e) {
      $(e.currentTarget).children('.delete').toggle();
    },

    hideTagMenu: function (e) {
        //$('.tag-name > #delete').remove();
      $(e.currentTarget).children('.delete').toggle();
    },

    deleteTag: function (e) {
      var self = this;

      if (confirm('削除しますか?')) {
        var csrf = $('.csrf').val()
          , postId = $(e.currentTarget).parents('.post').attr('data-post-id')
          , tagElm = $(e.currentTarget).parent()
          , tagName = $(e.currentTarget).siblings('a').html();

        $.ajax({
          url: '/tags/' + tagName,
          type: 'DELETE',
          data: { _csrf: csrf, postId: postId },
          success: function () {
            self.socket.emit('deleteTag', { postId: postId, tagName: tagName });
            tagElm.remove();
          }
        });
      }
    }
  });


  return {
    PostFormView: PostFormView,

    PostView: PostView,

    HomeTimelineView: PostView.extend({
      initialize: function (options) {
        this.socket = options.socket;
        // 親クラスであるPostViewのコンストラクタにsocketを渡す
        PostView.prototype.initialize({ socket: this.socket });

        _.bindAll(this, 'render');
        this.collection = new PostCollection.HomeTimeline();
        this.collection.bind('reset', this.render);
        this.collection.fetch();
      }
    }),

    SinglePostView: PostView.extend({
      initialize: function (options) {
        var postElm = $('.post-component')
          , postId = options.postId;

        this.socket = options.socket;
        PostView.prototype.initialize({ socket: this.socket });

        this.model = new PostModel.SinglePost({ postId: postId });
        this.model.fetch({
          success: function (collection, response) {
            document.title = string.truncate(response.title, 45) + ' - Anoside';

            var convertedPost = doc.convert(response)
              , convertedComments = response.comments.map(function (comment) { return doc.convert(comment) });
            
            $('#showPostsTmpl').tmpl(convertedPost, { userId: Anoside.user.id }).appendTo(postElm);
            $('#showCommentsTmpl').tmpl(convertedComments).appendTo($('ul.comments'));

            $('.datetime').timeago();
          }
        });
      }
    })
  }
});
