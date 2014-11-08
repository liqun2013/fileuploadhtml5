/**
 * Utility method to format bytes into the most logical magnitude (KB, MB, or GB).
 */
Number.prototype.formatBytes = function () {
	var units = ['B', 'KB', 'MB', 'GB', 'TB'],
        bytes = this,
        i;

	for (i = 0; bytes >= 1024 && i < 4; i++) {
		bytes /= 1024;
	}

	return bytes.toFixed(2) + units[i];
}

$(function () {
	var upload_form = $('#upload_form'),
		file_input = $('#selectedFile'),
		file_list = $('#file_list'),
		uploaders = [];

	file_input.on('change', function (e) {
		var files = e.target.files,
			file,
			list_item,
			uploader;

		file_list.empty();
		uploaders = [];

		for (var i = 0; i < files.length; i++) {
			file = files[i];
			uploader = new ChunkedUploader(file, { url: uploadProcessUrl });
			uploaders.push(uploader);
			list_item = $('<li>' + file.name + '(' + file.size.formatBytes() + ') </li>').data('uploader', uploader);
			file_list.append(list_item);
		}

		file_list.show();
		upload_form.submit();
	});

	upload_form.on('submit', function (e) {
		$.each(uploaders, function (i, uploader) {
			uploader.start();
		});

		uploaders = [];

		// Prevent default form submission
		e.preventDefault();
	});

	file_list.delegate("button", "click", function (e) {
		var btn = $(this),
			uploader = btn.parent('li').data('uploader');

		if (btn.hasClass('paused')) {
			btn.removeClass('paused').text('暂停');
			uploader.resume();
		}
		else {
			btn.addClass('paused').text('继续');
			uploader.pause();
		}
	});
});

function ChunkedUploader(file, options) {
	if (!this instanceof ChunkedUploader) {
		return new ChunkedUploader(file, options);
	}

	this.file = file;

	//this.options = $.extend({
	//	url: 'http://10.1.200.211:8050/FileUpload/ProcessUpload'
	//}, options);
	this.options = options;
	this.file_size = this.file.size;
	this.chunk_size = (1024 * 64); // 64KB
	this.range_start = 0;
	this.range_end = this.chunk_size;

	if ('mozSlice' in this.file) {
		this.slice_method = 'mozSlice';
	}
	else if ('webkitSlice' in this.file) {
		this.slice_method = 'webkitSlice';
	}
	else {
		this.slice_method = 'slice';
	}

	var self = this;

	this.upload_request = new XMLHttpRequest();
	this.upload_request.onload = function () { self._onChunkComplete(); };

	// Respond to changes in connection
	if ('onLine' in navigator) {
		window.addEventListener('online', this._onConnectionFound);
		window.addEventListener('offline', this._onConnectionLost);
	}
}

ChunkedUploader.prototype = {

	_upload: function () {
		var self = this,
            chunk;

		// Slight timeout needed here (File read / AJAX readystate conflict?)
		setTimeout(function () {
			// Prevent range overflow
			if (self.range_end > self.file_size) {
				self.range_end = self.file_size;
			}

			chunk = self.file[self.slice_method](self.range_start, self.range_end);

			self.upload_request.open('PUT', self.options.url, true);
			self.upload_request.overrideMimeType('application/octet-stream');

			self.upload_request.setRequestHeader('Content-FileName', self.file.name);
			self.upload_request.setRequestHeader('Content-FileLastModified', self.file.lastModifiedDate);
			self.upload_request.setRequestHeader('Content-FileType', self.file.type);
			self.upload_request.setRequestHeader('Content-FileSize', self.file_size);

			self.upload_request.setRequestHeader('Content-RangeStart', self.range_start);
			self.upload_request.setRequestHeader('Content-RangeEnd', self.range_end);

			self.upload_request.send(chunk);
		}, 20);
	},

	_onChunkComplete: function () {

		var $li = $('#file_list').find("li:contains(" + this.file.name + ")");
		var $btn = $li.find('button');
		var $span = $li.find('span');
		if ($span.length > 0) {
			$span.text(Math.ceil((this.range_end / this.file_size) * 100) + "%");
		}
		else {
			$btn.before("<span>" + Math.ceil((this.range_end / this.file_size) * 100) + "%</span>");
		}


		// If the end range is already the same size as our file, we
		// can assume that our last chunk has been processed and exit
		// out of the function.
		if (this.range_end === this.file_size) {
			this._onUploadComplete();
			return;
		}

		var resp = JSON.parse(this.upload_request.response);

		if (resp.Error) {
			return;
		}

		if (resp.Success) {
			if (resp.UploadedRange) {
				this.range_start = resp.UploadedRange;
				this.range_end = this.range_start + this.chunk_size;
			}
			else if (resp.UploadedRange == 0) {
				this.range_start = resp.UploadedRange;
				this.range_end = this.range_start + this.chunk_size;
			}
			else {
				this.range_start = this.range_end;
				this.range_end = this.range_start + this.chunk_size;
			}

			// Continue as long as we aren't paused
			if (!this.is_paused) {
				this._upload();
			}
		}
	},

	_onUploadComplete: function () {
		var $li = $('#file_list').find("li:contains(" + this.file.name + ")");
		var $btn = $li.find('button').remove();
	},

	_onConnectionFound: function () {
		this.resume();
	},

	_onConnectionLost: function () {
		this.pause();
	},

	start: function () {
		var $li = $('#file_list').find("li:contains(" + this.file.name + ")");
		if ($li.find('button').length == 0) {
			$li.append("<button class='btn btn-default btn-xs'>暂停</button>");
		}

		this._upload();
	},

	pause: function () {
		this.is_paused = true;
	},

	resume: function () {
		this.is_paused = false;
		this._upload();
	}
};

