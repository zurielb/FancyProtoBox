// Detect if the browser is IE6 or less
var ie = navigator.userAgent.match(/MSIE\s(\d)+/);

if (ie) {
  var version = parseInt(ie[1]);
  Prototype.Browser['IE' + version.toString()] = true;
  Prototype.Browser.ltIE7 = (version < 7) ? true : false;
}

// Add convenience functions
Object.extend(String.prototype, {
  // if a string doesn't end with str it appends it
  ensureEndsWith: function(str) {
    return this.endsWith(str) ? this : this + str;
  },

  // makes sure that string ends with px (for setting widths and heights)
  px: function() {
    return this.ensureEndsWith('px');
  }
});

Object.extend(Number.prototype, {
  // makes sure that number ends with px (for setting widths and heights)
  px: function() {
    return this.toString().px();
  }
});

var FancyProtoBox = {};

(function(){
	var _setup = false, _busy = false, _visible = false, _current_instance = null;
	var _loadingTimer, _loadingFrame = 1, _imagePreloader = new Image, _imageRegExp = /\.(jpg|gif|png|bmp|jpeg)(.*)?$/i;
	var _overlay, _loading, _outer, _inner, _bg, _close, _content;	
	
	//internal functions	
	function _fixPNG(element) {
		var image = element.getStyle('background-image');
		var position = element.getStyle('position');

		if (image.match(/^url\(["']?(.*\.png)["']?\)$/i)) {
			image = RegExp.$1;
		
			element.setStyle({
				backgroundImage: 'none',
				filter: "progid:DXImageTransform.Microsoft.AlphaImageLoader(enabled=true, sizingMethod=" + (element.getStyle('backgroundRepeat') == 'no-repeat' ? 'crop' : 'scale') + ", src='" + image + "')"
			});
		
			if (position != 'absolute' && position != 'relative')
				element.setStyle({position: 'relative'});
		}
	}
	
	// just a convinience method
	function _getWindowDimensions() {
		var dimensions = document.viewport.getDimensions();
		var offsets = document.viewport.getScrollOffsets();
	
		return {
			'width' : dimensions.width, 
			'height': dimensions.height, 
			'left'  : offsets.left, 
			'top'   : offsets.top
		};
	}
	
	// initial fancy protobox build
	function _build() {
    if (_setup) return;

    _setup = true;
		_visible = false;

		var html = '<div id="fancy-tmp" style="display: none;"></div>'
		html += '<div id="fancy_overlay" style="display: none;"></div>';
		html += '<div id="fancy_loading" style="display: none;"><div></div></div>';
		html +=	'<div id="fancy_outer" style="display: none;">';
		html +=	'<div id="fancy_inner">';
		html +=	'<div id="fancy_close"></div>';
		html +=	'<div id="fancy_bg"><div class="fancy_bg" id="fancy_bg_n"></div><div class="fancy_bg" id="fancy_bg_ne"></div><div class="fancy_bg" id="fancy_bg_e"></div><div class="fancy_bg" id="fancy_bg_se"></div><div class="fancy_bg" id="fancy_bg_s"></div><div class="fancy_bg" id="fancy_bg_sw"></div><div class="fancy_bg" id="fancy_bg_w"></div><div class="fancy_bg" id="fancy_bg_nw"></div></div>';
		html +=	'<div id="fancy_content"></div>';
		html +=	'</div>'
		html +=	'</div>'
		html +=	'<div id="fancy_title" style="display: none;"><table cellspacing="0" cellpadding="0" border="0"><tr><td class="fancy_title" id="fancy_title_left"></td><td class="fancy_title" id="fancy_title_main"><div></div></td><td class="fancy_title" id="fancy_title_right"></td></tr></table></div>';
  
    $$('body').first().insert(html);
  
		_temp = $('fancy-tmp');
		_overlay = $('fancy_overlay');
		_loading = $('fancy_loading');
    _outer = $('fancy_outer');
		_inner = $('fancy_inner');
    _bg = $('fancy_bg');
    _close = $('fancy_close');
    _content = $('fancy_content');
		_title = $('fancy_title');

    _close.observe('click', FancyProtoBox.hide);

    // ie suxs
    if (Prototype.Browser.IE) {				
			// IE SUX!!!!
			$$("#fancy_loading div, .fancy_title, .fancy_ico").each(function(element){
				_fixPNG(element);
			});
    }
  }

	// Instance Class for creating new FancyProtoBox windows
	FancyProtoBox = Class.create({
		initialize: function(element) {
			this.options = Object.extend({
				animationDuration	: 0.4,
				// styles: morph, fade, none
				animationStyle		: 'fade',
				// styles: none, default, rounded-white, rounded-black
				windowStyle 			: 'default', 
				frameWidth				:	560,
				frameHeight				:	340,
				//padding						:	5,
				overlayShow				:	true,
				overlayOpacity		:	0.4,
				overlayColor			:	'#666',
				hideOnOverlayClick:	true,
				hideOnContentClick:	true,
				centerOnScroll		: true,
				callbackOnShow		:	null,
				callbackOnClose		:	null,
				title							: '',
				titleShow					: true
			}, arguments[1] || {});
		
		  _build();
		
			this.element = $(element);
			this.inline = false;
			
			if(this.element && this.element.tagName.toUpperCase() == 'A')
				this.element.observe('click', this.show.bind(this));
		},
	
		show: function(e) {	
			if(e) e.stop();
		
			if (_busy) return;
			
			_busy = true;
			_visible = true;
			_current_instance = this;
			
			var dimensions  = _getWindowDimensions();
			
			// capture the origin of the event
			this.originY = e ? e.pointerY() : ((dimensions.height/2) + dimensions.top);
			this.originX = e ? e.pointerX() : (dimensions.width/2);
			this.item = { title: '' };
			
			// set up content
			if (this.element) {
				if(this.element.tagName.toUpperCase() == 'A') {
					this.item.href  = this.element.readAttribute('href');
					this.item.title = this.element.readAttribute('title');
					
					if(this.item.href.match("iframe") || this.element.className.indexOf("iframe") >= 0) {
						this._showLoading();
						this._processFrame();					
					} else if(this.item.href.match(/#/)) {						
						this.inline = true;
						this.item.content = $(this.item.href.gsub(/^#/, ''));
					} else if (this.item.href.match(_imageRegExp)) {						
						_imagePreloader = new Image; 
						_imagePreloader.src = this.item.href;
						
						if (_imagePreloader.complete) {
							this._processImage();

						} else {
							this._showLoading();
							_imagePreloader.onload = this._processImage.bind(this);
						}
					} else {						
						this._showLoading();
						this._processAjax();
					}
				} else if( this.element.tagName.toUpperCase() == 'DIV') {					
					this.inline = true;
					this.item.content = this.element;
				}
				
				if(this.inline && this.item.content) {
					var content_div = new Element('div', {'id': 'fancy_div'});
					var content_width = this.options.width ? this.options.width: this.item.content.getWidth();
					var content_height = this.options.height ? this.options.height :  this.item.content.getHeight()
					
					this.item.content.immediateDescendants().each(function(element){
						content_div.insert(element.remove());
					});
					
					_content.update();
					_content.insert(content_div);
					content_div.hide();
					
					this._showContent(content_div, content_width,content_height, this.item.title);
				}
			}
		},
	
		hide: function(e) {
		
			if(e) e.stop();
		
			if (_busy) return;
			_busy = true;
			
			if(this.options.animationStyle == 'morph') {
				new Effect.Parallel([
					new Effect.Fade(_overlay, {sync: true}),
					new Effect.Move(_outer, {x: this.moveX*-1, y: this.moveY*-1, sync: true}),
					new Effect.Morph(_outer, {
					  style: {
					    width: '1'.px(),
					    height: '1'.px()
					  },
						sync: true,
						beforeStart: this._cleanupContent.bind(this),
						afterFinish: function(effect) {
							_busy = false;
							_current_instance = null;
						}
					}),
					new Effect.Fade(_outer, {sync:true})
				], { duration: this.options.animationDuration });
			} else if(this.options.animationStyle == 'fade') {
				new Effect.Parallel([
					new Effect.Fade(_overlay, {sync: true}),
					new Effect.Fade(_outer, {
						sync: true,
						beforeStart: this._cleanupContent.bind(this),
						afterFinish: function(effect) {
							_busy = false;
							_current_instance = null;
						}
					})
				], { duration: this.options.animationDuration });
			} else {
				this._cleanupContent();
				_outer.hide();
				_overlay.hide();
				_busy = false;
				_current_instance = null;
			}
		
			this._unbindEventHandlers();
		
			if(this.options.callbackOnClose) this.options.callbackOnClose();
		},
	
		// internal functions
		
		_showContent: function(content_div, content_width, content_height, content_title) {
			var windowStyle = this.options.windowStyle;			
			var styleObj 		= FancyProtoBox.windowStyles[windowStyle];
			var padding 		= this.options.padding;
			var dimensions  = _getWindowDimensions();
			var width				= content_width;
			var height			= content_height;
			var title				= content_title && this.options.titleShow ? content_title : '';
			var titleOffset = 0;
			var topPadding	= 0;
			
			// if a title was set in the options override whatever the title was
			if(this.options.title.length > 0 && this.options.titleShow)
				title = this.options.title;
				
			this._bindEventHandlers();
			
			// set up window theme
			if(styleObj) {
				//remove all classNames
				_inner.className = '';
				_close.className = '';
				
				//reset styles
				_close.setStyle({
					backgroundImage: '',
					filter: ''
				});
				
				_bg.select('.fancy_bg').each(function(element){
					element.setStyle({
						backgroundImage: '',
						filter: ''
					});
				});
				
				//add theme className
				if(this.options.windowStyles !=  'none') {
					_inner.className = styleObj.cssClass;
					_close.className = styleObj.cssClass;
				}
				
				if(typeof padding == 'undefined') {
					padding = styleObj.defaultPadding;
				}
				
				topPadding = styleObj.topPadding;
				titleOffset = styleObj.titleOffset;
				
				// IE SUX!!!!
				if (Prototype.Browser.IE) {	
		      _bg.select('.fancy_bg').each(function(element){
						_fixPNG(element);
					});
					
					_fixPNG(_close);
				}
			}

			// set up content dimensions
			if(Prototype.Browser.ltIE7) {			
				_content.style.removeExpression("height");
				_content.style.removeExpression("width");
			}
		
			if(padding > 0) {
				width	+= padding * 2;
				height	+= (padding * 2) + topPadding;
			
				_content.setStyle({
					top		: (padding + topPadding).px(),
					right	: padding.px(),
					bottom: padding.px(),
					left	: padding.px(),
					width	: 'auto',
					height: 'auto'
				});
			
				if(Prototype.Browser.ltIE7) {
					_content.style.setExpression('height',	'(this.parentNode.clientHeight - '	+ padding * 2 + ')');
					_content.style.setExpression('width',	'(this.parentNode.clientWidth - '	+ padding * 2 + ')');
				}
			} else {
				_content.setStyle({
					top		: 0,
					right	: 0,
					bottom: 0,
					left	: 0,
					width	: '100%',
					height: '100%'
				});
			}
		
			// set up overlay
			if (this.options.overlayShow) {			
				if (Prototype.Browser.ltIE7) {
					_overlay.setStyle({
						height: dimensions.height.px(),
						position: 'absolute',
						top: dimensions.top.px()
					});
				}
			
				_overlay.setStyle({
					backgroundColor: this.options.overlayColor,
					opacity: this.options.overlayOpacity
				});
			} else {
				_overlay.setStyle({
					backgroundColor: 'transparent',
					opacity: 0.0
				});
			}
		
			// ensure that newTop is at least 0 so it doesn't hide close button
			var newTop  = Math.max((dimensions.height/2) - ((height + 60)/2) + dimensions.top, 0);
			var newLeft = (dimensions.width/2) - ((width + 40)/2);

			
			//animate
			if(this.options.animationStyle == 'morph') {
				this.moveX   = -(this.originX - newLeft);
				this.moveY   = -(this.originY - newTop);

				// set point of origin to start the animation
		    _outer.hide().setStyle({
					position	: 'absolute',
					top				: this.originY.px(),
					left			: this.originX.px()
				});
				
				new Effect.Parallel([
					new Effect.Appear(_overlay, {sync:true, to: this.options.overlayOpacity}),
					new Effect.Appear(_outer, {sync:true}),
					new Effect.Move(_outer, {x: this.moveX, y: this.moveY, sync: true}),
					new Effect.Morph(_outer, {
					  style: {
					    width: width.px(),
					    height: height.px()
					  },
						sync: true,
						afterFinish: this._processContent.bind(this, content_div, title, titleOffset)
					})
				], { duration: this.options.animationDuration });
				
			} else if(this.options.animationStyle == 'fade') {
				
				_outer.hide().setStyle({
					position	: 'absolute',
					top				: newTop.px(),
					left			: newLeft.px(),
					width: width.px(),
			    height: height.px()
				});
				
				new Effect.Parallel([
					new Effect.Appear(_overlay, {sync: true, to: this.options.overlayOpacity }),
					new Effect.Appear(_outer, {
						sync: true,
						afterFinish: this._processContent.bind(this, content_div, title, titleOffset)
					})
				], { duration: this.options.animationDuration });
			}
			else {
				_outer.hide().setStyle({
					position	: 'absolute',
					top				: newTop.px(),
					left			: newLeft.px(),
					width: width.px(),
			    height: height.px()
				});
				
				_overlay.show();
				_outer.show();
				this._processContent(content_div, title, titleOffset);
			}
		},
		
		_processContent: function(content_div, title, titleOffset) {			
			var dimensions  = _getWindowDimensions();
			
			_content.down().show();
			
			if(typeof title !== 'undefined' && title.length > 0) {
				var position = _outer.viewportOffset();

				_title.down('div').update(title);

				_title.setStyle({
					top: (position.top + _outer.getHeight() + dimensions.top - titleOffset).px(),
					left: (position.left + (_outer.getWidth() * 0.5) - (_title.getWidth() * 0.5)).px()
				});

				_title.show();
			}
			
			_close.show();
			_loading.hide();
			_busy = false;
			
			if(this.options.callbackOnShow) this.options.callbackOnShow();
		},
		
		_cleanupContent: function(e) {
			// when we have inline content we have to restore the nodes back to their original position
			if(this.inline) {
				var inline_content = this.item.content;				
				_content.down('div').immediateDescendants().each(function(element){
					inline_content.insert(element.remove());
				});
			}
		
			_content.update();
			_title.down('div').update();
			_visible = false;
			_close.hide();
			_title.hide();
			_loading.hide();
		},
		
		_processFrame: function() {					
			var content_width = this.options.width ? this.options.width: this.options.frameWidth;
			var content_height = this.options.height ? this.options.height :  this.options.frameHeight;
			
			var frame_element = '<iframe id="fancy_frame" onload="FancyProtoBox.showIframe()" name="fancy_iframe' + Math.round(Math.random()*1000) + '" frameborder="0" hspace="0" src="' + this.item.href + '"></iframe>';
			
			// this is a hack to get the iFrame working on IE
			FancyProtoBox.showIframe = this._showContent.bind(this, frame_element, content_width, content_height, this.item.title);
			
			_content.update();
			_content.insert(frame_element);
		},
		
		_alert: function() {
			alert('Iframe Loaded!');
		},
		
		_processAjax: function() {		
			new Ajax.Request(this.item.href, {
		    method:'get',
		    onSuccess: this._processAjaxRequest.bind(this),
		    onFailure: function(){ console.log('Something went wrong...')}
		  });
		},
		
		_processAjaxRequest: function(transport) {			
			var ajax_div = new Element('div', {'id': 'fancy_ajax'}).update(transport.responseText);
			
			_temp.insert(ajax_div);
			
			var content_width = this.options.width ? this.options.width : _temp.getWidth();
			var content_height = this.options.height ? this.options.height : _temp.getHeight();
			
			_content.update(_temp.down('#fancy_ajax'));
			
			this._showContent(ajax_div, content_width, content_height, this.item.title);
		},
		
		_processImage: function() {
			var width	= _imagePreloader.width;
			var height	= _imagePreloader.height;
			var image_div = new Element('img', {'id': 'fancy_img', 'src': _imagePreloader.src });

			_content.update();
			_content.insert(image_div);
			
			this._showContent(image_div, width, height, this.item.title);
		},
		
		_showLoading: function() {
			clearInterval(_loadingTimer);

			var dimensions = _getWindowDimensions();
			
			_loading.setStyle({
				left: ((dimensions.width - 40) * 0.5 + dimensions.left).px(),
				top: ((dimensions.height - 40) * 0.5 + dimensions.top).px()
			});
			
			_loading.observe('click', this.hide.bind(this));
			
			_loading.show();

			loadingTimer = setInterval(this._animateLoading, 66);
		},
		
		_animateLoading: function() {
			if (!_loading.visible()) {
				clearInterval(_loadingTimer);
				return;
			}
			
			_loading.firstDescendant().setStyle({
				top: (_loadingFrame * -40).px()
			});

			_loadingFrame = (_loadingFrame + 1) % 12;
		},
	
		_bindEventHandlers: function() {
			// we gotta keep a handle on the bound functions so we can unbind them later
			this._boundBodyClickHandler = this._bodyClickHandler.bind(this);
			this._boundEscKeyHandler = this._escKeyHandler.bind(this);
			this._boundWindowChangeHandler = this._windowChangeHandler.bind(this);

			// hide if click fired is not inside window
			Event.observe($$('html').first(), 'click', this._boundBodyClickHandler);
	    // esc to close
			Event.observe(document,'keyup', this._boundEscKeyHandler);
			// reposition window
			Event.observe(window, 'resize', this._boundWindowChangeHandler);
			Event.observe(window, 'scroll', this._boundWindowChangeHandler);
		},
	
		_unbindEventHandlers: function() {
			Event.stopObserving($$('html').first(), 'click', this._boundBodyClickHandler);
			Event.stopObserving(document,'keyup', this._boundEscKeyHandler);
			Event.stopObserving(window, 'resize', this._boundWindowChangeHandler);
			Event.stopObserving(window, 'scroll', this._boundWindowChangeHandler);
		},
	
		// event handlers
		_imageLoadedHandler: function(event) {
			_loading.hide();
			this._processImage();
		},
		
		_windowChangeHandler: function(e) {		
			if(_visible) {
				var dimensions = _getWindowDimensions();
			
				if(this.options.centerOnScroll) {
					var width	= _outer.getWidth();
					var height	= _outer.getHeight();
								
					_outer.setStyle({
						top	: (height > dimensions.height ? dimensions.top : dimensions.top + Math.round((dimensions.height - height) * 0.5)).px(),
						left	: (width > dimensions.width ? dimensions.left : dimensions.left + Math.round((dimensions.width - width) * 0.5)).px()
					});
					
					if(_title.visible()) {
						var position = _outer.viewportOffset();

						_title.setStyle({
							top: (position.top + _outer.getHeight() + dimensions.top - 32).px(),
							left: (position.left + (_outer.getWidth() * 0.5) - (_title.getWidth() * 0.5)).px()
						});
					}
				}
			
				if (Prototype.Browser.ltIE7) {
					_overlay.setStyle({
						height: document.viewport.getHeight().px(),
						top: dimensions.top.px()
					});
				}
			}
		},
	
		_bodyClickHandler: function(e) {
			var click_in_zoom = e.findElement('#fancy_outer');
	    if (_visible && (!click_in_zoom || this.options.hideOnContentClick)) {
	      this.hide(e);
	    }
		},
	
		_escKeyHandler: function(e) {
	    if (e.keyCode == Event.KEY_ESC && visible) {
	      this.hide(e);
	    }
		}
	});

	// Setting up the static Properties and Methods
	Object.extend(FancyProtoBox, {
		windowStyles: {
			'none': 					{cssClass: '',									defaultPadding: 0,	topPadding: 0,	titleOffset: 32}, 
			'default': 				{cssClass: 'fancyDefault', 			defaultPadding: 10,	topPadding: 0,	titleOffset: 32},
			'rounded-white': 	{cssClass: 'fancyRoundedWhite',	defaultPadding: 5, 	topPadding: 20,	titleOffset: 26},
			'rounded-black': 	{cssClass: 'fancyRoundedBlack',	defaultPadding: 5, 	topPadding: 20,	titleOffset: 26}
		},
		
		init: function(selector) {
			var opts = arguments[1] || {};
			$$(selector).each(function(el) { new FancyProtoBox(el, opts); });
		},
		
		hide: function(e) {
			if(_visible) {
				_current_instance.hide(e);
			}
		},
		
		isVisible: function() {
			return _visible;
		}
	});
})();