var express = require('express');
var router = express.Router();
var path = require('path');
var jsonfile = require('jsonfile');
var _ = require('lodash');
var moment = require('moment');

var ledgerFilePath = path.join(__dirname, "../data/ledger.json");
var people = ["steve", "shy"];

router.get('/', function(req, res, next) {
  jsonfile.readFile(ledgerFilePath, function(err, payments) {
    if (err) return next(err);

    var money = {};
    function record(who, owedTo, amount) {
      if (!money[who]) {
        money[who] = {};
      }

      if (!money[who][owedTo]) {
        money[who][owedTo] = 0;
      }

      if (!money[owedTo]) {
        money[owedTo] = {};
      }

      if (!money[owedTo][who]) {
        money[owedTo][who] = 0;
      }

      // if they owe them, just subtract it out
      amount -= money[owedTo][who];
      money[owedTo][who] = 0; // temp
      if (amount > 0) {
        money[who][owedTo] += amount;
      } else {
        money[owedTo][who] = amount * -1;
      }
    }

    _.each(payments, function(payment) {
      payment.when_readable = moment(payment.when).format("MMM Do YYYY");

      if (payment.to === "vendor") {
        var splitAmount = payment.amount / people.length;
        _.each(people, function(person) {
          if (person === payment.from) return; // skip
          record(person, payment.from, splitAmount);
        });
      } else {
        record(payment.to, payment.from, payment.amount);
      }
    });

    res.render('ledger', {
      payments: payments,
      people: people,
      money: money
    });
  });
});

router.post('/', function(req, res, next) {
  var entry = _.pick(req.body, [
    "from",
    "to",
    "amount",
    "what"
  ]);
  entry.when = (new Date()).getTime();

  if (!entry.from || !entry.to) {
    req.flash('error', 'money should not just disappear');
    return res.redirect('/payments');
  }

  if (entry.from === entry.to) {
    req.flash('error', 'why would you want to pay the same person?');
    return res.redirect('/payments');
  }

  try {
    entry.amount = parseInt(entry.amount);
  } catch (err) {
    req.flash('error', 'money should have a value and not a promise');
    return res.redirect('/payments');
  }

  if (!entry.what) {
    req.flash('error', 'why would you send money for no reason?');
    return res.redirect('/payments');
  }

  jsonfile.readFile(ledgerFilePath, function(err, payments) {
    if (err) return next(err);

    // ordered by date desc
    payments.unshift(entry);

    jsonfile.writeFile(ledgerFilePath, payments, function(err) {
      if (err) return next(err);
      req.flash('info', 'added');
      return res.redirect('/payments');
    });
  });
});

module.exports = router;
