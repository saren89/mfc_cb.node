'use strict';

var Promise = require('bluebird');
var S       = require('string');
var colors  = require('colors/safe');
var mfc     = require('MFCAuto');
var bhttp   = require('bhttp');
var cheerio = require('cheerio');
var common  = require('./common');

var session = bhttp.session();
var me; // backpointer for common printing methods

var filesCurrentlyCapturing = [];
var modelsCurrentlyCapturing = [];

module.exports = {
  create: function(myself) {
    me = myself;
  },

  getOnlineModels: function(page) {
    return getOnlineModels(page);
  },

  getFilesCurrentlyCapturing: function() {
    return filesCurrentlyCapturing;
  },

  setFilesCurrentlyCapturing: function(files) {
    filesCurrentlyCapturing = files;
  },

  getModelsCurrentlyCapturing: function() {
    return modelsCurrentlyCapturing;
  },

  setModelsCurrentlyCapturing: function(models) {
    modelsCurrentlyCapturing = models;
  },

  addModelToCurrentlyCapturing: function(model) {
    modelsCurrentlyCapturing.push(model);
  },

  setupCapture: function(nm, tryingToExit) {
    if (modelsCurrentlyCapturing.indexOf(nm) != -1) {
      common.dbgMsg(me, colors.model(nm) + ' is already capturing');
      return Promise.try(function() {
        var bundle = {spawnArgs: '', filename: '', model: ''};
        return bundle;
      });
     }

    if (tryingToExit) {
      common.dbgMsg(me, colors.model(nm) + ' is now online, but capture not started due to ctrl+c');
      return Promise.try(function() {
        var bundle = {spawnArgs: '', filename: '', model: ''};
        return bundle;
      });
    }

    common.msg(me, colors.model(nm) + ' is now online, starting capturing process');

    return Promise.try(function() {
      return getStream(nm);
    }).then(function (url) {
      var filename = common.getFileName(me, nm);
      filesCurrentlyCapturing.push(filename);
      var jobs = [];
      var spawnArgs = common.getCaptureArguments(url, filename);

      var bundle = {spawnArgs: spawnArgs, filename: filename, model: nm};
      jobs.push(bundle);
      return jobs;
    })
    .catch(function(err) {
      common.errMsg(me, colors.model(nm) + ' ' + err.toString());
    });
  }
}

function getOnlineModels(page) {
    return Promise.try(function() {
      return session.get('https://chaturbate.com/followed-cams/?page=' + page);
    }).then(function(response) {

      var $ = cheerio.load(response.body);

      // Get an array of models found on this page
      var currentModels = $("#main div.content ul.list").children("li")
      .filter(function(){
          return $(this).find("div.details ul.sub-info li.cams").text() != "offline";
      })
      .map(function(){
          return $(this).find("div.title a").text().trim().split(',');
      })
      .get();

      // Find the total number of model pages
      var pages = $("#main div.content ul.paging").children("li")
      .filter(function() {
          return $(this).find('a').text().trim() != 'next';
      })
      .map(function() {
          return $(this).find('a').text().trim();
      })
      .get();
      var totalPages = pages[pages.length-1];

      //common.dbgMsg(me, 'Fetching page ' + page + '/' + totalPages);

      // Recurse until models on all pages are loaded
      if (page < totalPages) {
        return getOnlineModels(page+1)
        .then(function(models) {
          return currentModels.concat(models);
        })
        .catch(function(err) {
          common.errMsg(me, err);
        })
      } else {
        return currentModels;
      }
    })
    .catch(function(err) {
      common.errMsg(me, err.toString());
    });
}

function getStream(nm) {
  return Promise.try(function() {
    return session.get('https://chaturbate.com/' + nm + '/');
  }).then(function (response) {
    var url = '';
    var $ = cheerio.load(response.body);

    var scripts = $('script')
    .map(function(){
      return $(this).text();
    }).get().join('');

    var streamData = scripts.match(/(https\:\/\/\w+\.stream\.highwebmedia\.com\/live-edge\/[\w\-]+\/playlist\.m3u8)/i);

    if (streamData !== null) {
      url = streamData[1];
    } else {
      common.errMsg(me, nm + ' is offline');
    }

    return url;
  })
  .catch(function(err) {
    common.errMsg(me, colors.model(nm) + ': ' + err.toString());
  });
}

