// Usage:
// cd /path/to/repo/tests
// jasmine spec/tests.js
//
// Dependencies:
// nodejs
// selenium
// jasmine
// see https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode#Automated_testing_with_headless_mode

// USER SPECIFIED OPTIONS
var browser = process.env.BROWSER; //"firefox"; // or "chrome"
if (!browser) {
    console.log("Browser can be set via environment variable, eg");
    console.log("BROWSER=firefox jasmine spec/tests.js");
    console.log("Options for BROWSER are firefox chrome");
    console.log("Using default browser: chrome");
    browser = "chrome";
}
else {
    console.log("Using browser: " + browser);
}

// Globals

var webdriver = require('selenium-webdriver');
var By = webdriver.By;
var Key = webdriver.Key;
var until = webdriver.until;
var newDriver = null;
var driver = null;
// Delays in ms
var generateDelay = 1000;
var feedbackDelay = 500;
var entropyFeedbackDelay = 500;

// url uses file:// scheme
var path = require('path')
var parentDir = path.resolve(process.cwd(), '..', 'src', 'index.html');
var url = "file://" + parentDir;
if (browser == "firefox") {
    // TODO loading local html in firefox is broken
    console.log("Loading local html in firefox is broken, see https://stackoverflow.com/q/46367054");
    console.log("You must run a server in this case, ie do this:");
    console.log("$ cd /path/to/bip39/src");
    console.log("$ python -m http.server");
    url = "http://localhost:8000";
}

// Variables dependent on specific browser selection

if (browser == "firefox") {
    var firefox = require('selenium-webdriver/firefox');
    var binary = new firefox.Binary(firefox.Channel.NIGHTLY);
    binary.addArguments("-headless");
    newDriver = function() {
        return new webdriver.Builder()
              .forBrowser('firefox')
              .setFirefoxOptions(new firefox.Options().setBinary(binary))
              .build();
    }
}
else if (browser == "chrome") {
    var chrome = require('selenium-webdriver/chrome');
    newDriver = function() {
        return new webdriver.Builder()
          .forBrowser('chrome')
          .setChromeOptions(new chrome.Options().addArguments("headless"))
          .build();
    }
}

// Helper functions

function testNetwork(done, params) {
    var phrase = params.phrase || 'abandon abandon ability';
    driver.findElement(By.css('.phrase'))
        .sendKeys(phrase);
    selectNetwork(params.selectText);
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe(params.firstAddress);
            done();
        });
    });
}

function getFirstRowValue(handler, selector) {
    driver.findElements(By.css(selector))
        .then(function(els) {
            els[0].getText()
                .then(handler);
        })
}

function getFirstAddress(handler) {
    getFirstRowValue(handler, ".address");
}

function getFirstPath(handler) {
    getFirstRowValue(handler, ".index");
}

function testColumnValuesAreInvisible(done, columnClassName) {
    var selector = "." + columnClassName + " span";
    driver.findElements(By.css(selector))
        .then(function(els) {
            els[0].getAttribute("class")
                .then(function(classes) {
                    expect(classes).toContain("invisible");
                    done();
                });
        })
}

function testRowsAreInCorrectOrder(done) {
    driver.findElements(By.css('.index'))
        .then(function(els) {
            var testRowAtIndex = function(i) {
                if (i >= els.length) {
                    done();
                }
                else {
                    els[i].getText()
                        .then(function(actualPath) {
                            var noHardened = actualPath.replace(/'/g, "");
                            var pathBits = noHardened.split("/")
                            var lastBit = pathBits[pathBits.length-1];
                            var actualIndex = parseInt(lastBit);
                            expect(actualIndex).toBe(i);
                            testRowAtIndex(i+1);
                        });
                }
            }
            testRowAtIndex(0);
        });
}

function selectNetwork(name) {
    driver.executeScript(function() {
        var selectText = arguments[0];
        $(".network option[selected]").removeAttr("selected");
        $(".network option").filter(function(i,e) {
            return $(e).html() == selectText;
        }).prop("selected", true);
        $(".network").trigger("change");
    }, name);
}

function testEntropyType(done, entropyText, entropyTypeUnsafe) {
    // entropy type is compiled into regexp so needs escaping
    // see https://stackoverflow.com/a/2593661
    var entropyType = (entropyTypeUnsafe+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy'))
        .sendKeys(entropyText);
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.entropy-container'))
            .getText()
            .then(function(text) {
                var re = new RegExp("Entropy Type\\s+" + entropyType);
                expect(text).toMatch(re);
                done();
            });
    });
}

function testEntropyBits(done, entropyText, entropyBits) {
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy'))
        .sendKeys(entropyText);
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.entropy-container'))
            .getText()
            .then(function(text) {
                var re = new RegExp("Total Bits\\s+" + entropyBits);
                expect(text).toMatch(re);
                done();
            });
    });
}

function testEntropyFeedback(done, entropyDetail) {
    // entropy type is compiled into regexp so needs escaping
    // see https://stackoverflow.com/a/2593661
    if ("type" in entropyDetail) {
        entropyDetail.type = (entropyDetail.type+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
    }
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy'))
        .sendKeys(entropyDetail.entropy);
    driver.sleep(entropyFeedbackDelay).then(function() {
        driver.findElement(By.css('.entropy-container'))
            .getText()
            .then(function(text) {
                driver.findElement(By.css('.phrase'))
                    .getAttribute("value")
                    .then(function(phrase) {
                        if ("filtered" in entropyDetail) {
                            var key = "Filtered Entropy";
                            var value = entropyDetail.filtered;
                            var reText = key + "\\s+" + value;
                            var re = new RegExp(reText);
                            expect(text).toMatch(re);
                        }
                        if ("type" in entropyDetail) {
                            var key = "Entropy Type";
                            var value = entropyDetail.type;
                            var reText = key + "\\s+" + value;
                            var re = new RegExp(reText);
                            expect(text).toMatch(re);
                        }
                        if ("events" in entropyDetail) {
                            var key = "Event Count";
                            var value = entropyDetail.events;
                            var reText = key + "\\s+" + value;
                            var re = new RegExp(reText);
                            expect(text).toMatch(re);
                        }
                        if ("bits" in entropyDetail) {
                            var key = "Total Bits";
                            var value = entropyDetail.bits;
                            var reText = key + "\\s+" + value;
                            var re = new RegExp(reText);
                            expect(text).toMatch(re);
                        }
                        if ("bitsPerEvent" in entropyDetail) {
                            var key = "Bits Per Event";
                            var value = entropyDetail.bitsPerEvent;
                            var reText = key + "\\s+" + value;
                            var re = new RegExp(reText);
                            expect(text).toMatch(re);
                        }
                        if ("words" in entropyDetail) {
                            var actualWords = phrase.split(/\s+/)
                                .filter(function(w) { return w.length > 0 })
                                .length;
                            expect(actualWords).toBe(entropyDetail.words);
                        }
                        if ("strength" in entropyDetail) {
                            var key = "Time To Crack";
                            var value = entropyDetail.strength;
                            var reText = key + "\\s+" + value;
                            var re = new RegExp(reText);
                            expect(text).toMatch(re);
                        }
                        done();
                    });
            });
    });
}

function testClientSelect(done, params) {
    // set mnemonic and select bip32 tab
    driver.findElement(By.css('#bip32-tab a'))
        .click()
    driver.findElement(By.css('.phrase'))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        // BITCOIN CORE
        // set bip32 client to bitcoin core
        driver.executeScript(function() {
            $("#bip32-client").val(arguments[0]).trigger("change");
        }, params.selectValue);
        driver.sleep(generateDelay).then(function() {
            // check the derivation path is correct
            driver.findElement(By.css("#bip32-path"))
                .getAttribute("value")
                .then(function(path) {
                expect(path).toBe(params.bip32path);
                // check hardened addresses is selected
                driver.findElement(By.css(".hardened-addresses"))
                    .getAttribute("checked")
                    .then(function(isChecked) {
                        expect(isChecked).toBe(params.useHardenedAddresses);
                        // check input is readonly
                        driver.findElement(By.css("#bip32-path"))
                            .getAttribute("readonly")
                            .then(function(isReadonly) {
                                expect(isReadonly).toBe("true");
                                done();
                            });
                    });
            });
        });
    });
}

// Tests

describe('BIP39 Tool Tests', function() {

    beforeEach(function(done) {
        driver = newDriver();
        driver.get(url).then(done);
    });

    // Close the website after each test is run (so that it is opened fresh each time)
    afterEach(function(done) {
        driver.quit().then(done);
    });

// BEGIN TESTS

// Page initially loads with blank phrase
it('Should load the page', function(done) {
    driver.findElement(By.css('.phrase'))
        .getAttribute('value').then(function(value) {
            expect(value).toBe('');
            done();
        });
});

// Page has text
it('Should have text on the page', function(done) {
    driver.findElement(By.css('body'))
        .getText()
        .then(function(text) {
            var textToFind = "You can enter an existing BIP39 mnemonic";
            expect(text).toContain(textToFind);
            done();
        });
});

// Entering mnemonic generates addresses
it('Should have a list of addresses', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElements(By.css('.address'))
            .then(function(els) {
                expect(els.length).toBe(20);
                done();
            })
    });
});

// Generate button generates random mnemonic
it('Should be able to generate a random mnemonic', function(done) {
    // initial phrase is blank
    driver.findElement(By.css('.phrase'))
        .getAttribute("value")
        .then(function(phrase) {
            expect(phrase.length).toBe(0);
            // press generate
            driver.findElement(By.css('.generate')).click();
            driver.sleep(generateDelay).then(function() {
                // new phrase is not blank
                driver.findElement(By.css('.phrase'))
                    .getAttribute("value")
                    .then(function(phrase) {
                        expect(phrase.length).toBeGreaterThan(0);
                        done();
                    });
            });
        });
});

// Mnemonic length can be customized
it('Should allow custom length mnemonics', function(done) {
    // set strength to 6
    driver.executeScript(function() {
        $(".strength option[selected]").removeAttr("selected");
        $(".strength option[value=6]").prop("selected", true);
    });
    driver.findElement(By.css('.generate')).click();
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.phrase'))
            .getAttribute("value")
            .then(function(phrase) {
                var words = phrase.split(" ");
                expect(words.length).toBe(6);
                done();
            });
    });
});

// Passphrase can be set
it('Allows a passphrase to be set', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.findElement(By.css('.passphrase'))
        .sendKeys('secure_passphrase');
    driver.sleep(generateDelay).then(function() {
      getFirstAddress(function(address) {
          expect(address).toBe("15pJzUWPGzR7avffV9nY5by4PSgSKG9rba");
          done();
      })
  });
});

// Network can be set to networks other than bitcoin
it('Allows selection of bitcoin testnet', function(done) {
    var params = {
        selectText: "BTC - Bitcoin Testnet",
        firstAddress: "mucaU5iiDaJDb69BHLeDv8JFfGiyg2nJKi",
    };
    testNetwork(done, params);
});
it('Allows selection of litecoin', function(done) {
    var params = {
        selectText: "LTC - Litecoin",
        firstAddress: "LQ4XU8RX2ULPmPq9FcUHdVmPVchP9nwXdn",
    };
    testNetwork(done, params);
});
it('Allows selection of ripple', function(done) {
    var params = {
        selectText: "XRP - Ripple",
        firstAddress: "rLTFnqbmCVPGx6VfaygdtuKWJgcN4v1zRS",
        phrase: "ill clump only blind unit burden thing track silver cloth review awake useful craft whale all satisfy else trophy sunset walk vanish hope valve",
    };
    testNetwork(done, params);
});
it('Allows selection of dogecoin', function(done) {
    var params = {
        selectText: "DOGE - Dogecoin",
        firstAddress: "DPQH2AtuzkVSG6ovjKk4jbUmZ6iXLpgbJA",
    };
    testNetwork(done, params);
});
it('Allows selection of shadowcash', function(done) {
    var params = {
        selectText: "SDC - ShadowCash",
        firstAddress: "SiSZtfYAXEFvMm3XM8hmtkGDyViRwErtCG",
    };
    testNetwork(done, params);
});
it('Allows selection of shadowcash testnet', function(done) {
    var params = {
        selectText: "SDC - ShadowCash Testnet",
        firstAddress: "tM2EDpVKaTiEg2NZg3yKg8eqjLr55BErHe",
    };
    testNetwork(done, params);
});
it('Allows selection of viacoin', function(done) {
    var params = {
        selectText: "VIA - Viacoin",
        firstAddress: "Vq9Eq4N5SQnjqZvxtxzo7hZPW5XnyJsmXT",
    };
    testNetwork(done, params);
});
it('Allows selection of viacoin testnet', function(done) {
    var params = {
        selectText: "VIA - Viacoin Testnet",
        firstAddress: "tM2EDpVKaTiEg2NZg3yKg8eqjLr55BErHe",
    };
    testNetwork(done, params);
});
it('Allows selection of jumbucks', function(done) {
    var params = {
        selectText: "JBS - Jumbucks",
        firstAddress: "JLEXccwDXADK4RxBPkRez7mqsHVoJBEUew",
    };
    testNetwork(done, params);
});
it('Allows selection of clam', function(done) {
    var params = {
        selectText: "CLAM - Clams",
        firstAddress: "xCp4sakjVx4pUAZ6cBCtuin8Ddb6U1sk9y",
    };
    testNetwork(done, params);
});
it('Allows selection of crown', function(done) {
    var params = {
        selectText: "CRW - Crown",
        firstAddress: "18pWSwSUAQdiwMHUfFZB1fM2xue9X1FqE5",
    };
    testNetwork(done, params);
});
it('Allows selection of dash', function(done) {
    var params = {
        selectText: "DASH - Dash",
        firstAddress: "XdbhtMuGsPSkE6bPdNTHoFSszQKmK4S5LT",
    };
    testNetwork(done, params);
});
it('Allows selection of dash testnet', function(done) {
    var params = {
        selectText: "DASH - Dash Testnet",
        firstAddress: "yaR52EN4oojdJfBgzWJTymC4uuCLPT29Gw",
    };
    testNetwork(done, params);
});
it('Allows selection of game', function(done) {
    var params = {
        selectText: "GAME - GameCredits",
        firstAddress: "GSMY9bAp36cMR4zyT4uGVS7GFjpdXbao5Q",
    };
    testNetwork(done, params);
});
it('Allows selection of namecoin', function(done) {
    var params = {
        selectText: "NMC - Namecoin",
        firstAddress: "Mw2vK2Bvex1yYtYF6sfbEg2YGoUc98YUD2",
    };
    testNetwork(done, params);
});
it('Allows selection of peercoin', function(done) {
    var params = {
        selectText: "PPC - Peercoin",
        firstAddress: "PVAiioTaK2eDHSEo3tppT9AVdBYqxRTBAm",
    };
    testNetwork(done, params);
});
it('Allows selection of ethereum', function(done) {
    var params = {
        selectText: "ETH - Ethereum",
        firstAddress: "0xe5815d5902Ad612d49283DEdEc02100Bd44C2772",
    };
    testNetwork(done, params);
    // TODO test private key and public key
});
it('Allows selection of slimcoin', function(done) {
    var params = {
        selectText: "SLM - Slimcoin",
        firstAddress: "SNzPi1CafHFm3WWjRo43aMgiaEEj3ogjww",
    };
    testNetwork(done, params);
});
it('Allows selection of slimcoin testnet', function(done) {
    var params = {
        selectText: "SLM - Slimcoin Testnet",
        firstAddress: "n3nMgWufTek5QQAr6uwMhg5xbzj8xqc4Dq",
    };
    testNetwork(done, params);
});
it('Allows selection of bitcoin cash', function(done) {
    var params = {
        selectText: "BCH - Bitcoin Cash",
        firstAddress: "1JKvb6wKtsjNoCRxpZ4DGrbniML7z5U16A",
    };
    testNetwork(done, params);
});
it('Allows selection of myriadcoin', function(done) {
    var params = {
        selectText: "XMY - Myriadcoin",
        firstAddress: "MJEswvRR46wh9BoiVj9DzKYMBkCramhoBV",
    };
    testNetwork(done, params);
});
it('Allows selection of pivx', function(done) {
    var params = {
        selectText: "PIVX - PIVX",
        firstAddress: "DBxgT7faCuno7jmtKuu6KWCiwqsVPqh1tS",
    };
    testNetwork(done, params);
});
it('Allows selection of pivx testnet', function(done) {
    var params = {
        selectText: "PIVX - PIVX Testnet",
        firstAddress: "yB5U384n6dGkVE3by5y9VdvHHPwPg68fQj",
    };
    testNetwork(done, params);
});
it('Allows selection of maza', function(done) {
    var params = {
        selectText: "MAZA - Maza",
        firstAddress: "MGW4Bmi2NEm4PxSjgeFwhP9vg18JHoRnfw",
    };
    testNetwork(done, params);
});
it('Allows selection of fujicoin', function(done) {
    var params = {
        selectText: "FJC - Fujicoin",
        firstAddress: "FgiaLpG7C99DyR4WnPxXedRVHXSfKzUDhF",
    };
    testNetwork(done, params);
});
it('Allows selection of nubits', function(done) {
    var params = {
        selectText: "USNBT - NuBits",
        firstAddress: "BLxkabXuZSJSdesLD7KxZdqovd4YwyBTU6",
    };
    testNetwork(done, params);
});
it('Allows selection of bitcoin gold', function(done) {
    var params = {
        selectText: "BTG - Bitcoin Gold",
        firstAddress: "GWYxuwSqANWGV3WT7Gpr6HE91euYXBqtwQ",
    };
    testNetwork(done, params);
});
it('Allows selection of monacoin', function(done) {
    var params = {
        selectText: "MONA - Monacoin",
        firstAddress: "MKMiMr7MyjDKjJbCBzgF6u4ByqTS4NkRB1",
    };
    testNetwork(done, params);
});

// BIP39 seed is set from phrase
it('Sets the bip39 seed from the prhase', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.seed'))
            .getAttribute("value")
            .then(function(seed) {
                expect(seed).toBe("20da140d3dd1df8713cefcc4d54ce0e445b4151027a1ab567b832f6da5fcc5afc1c3a3f199ab78b8e0ab4652efd7f414ac2c9a3b81bceb879a70f377aa0a58f3");
                done();
            })
    });
});

// BIP32 root key is set from phrase
it('Sets the bip39 root key from the prhase', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.root-key'))
            .getAttribute("value")
            .then(function(seed) {
                expect(seed).toBe("xprv9s21ZrQH143K2jkGDCeTLgRewT9F2pH5JZs2zDmmjXes34geVnFiuNa8KTvY5WoYvdn4Ag6oYRoB6cXtc43NgJAEqDXf51xPm6fhiMCKwpi");
                done();
            })
    });
});

// Tabs show correct addresses when changed
it('Shows the correct address when tab is changed', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('#bip32-tab a'))
            .click();
        driver.sleep(generateDelay).then(function() {
            getFirstAddress(function(address) {
                expect(address).toBe("17uQ7s2izWPwBmEVFikTmZUjbBKWYdJchz");
                done();
            });
        });
    });
});

// BIP44 derivation path is shown
it('Shows the derivation path for bip44 tab', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('#bip44 .path'))
            .getAttribute("value")
            .then(function(path) {
                expect(path).toBe("m/44'/0'/0'/0");
                done();
            })
    });
});

// BIP44 extended private key is shown
it('Shows the extended private key for bip44 tab', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.extended-priv-key'))
            .getAttribute("value")
            .then(function(path) {
                expect(path).toBe("xprvA2DxxvPZcyRvYgZMGS53nadR32mVDeCyqQYyFhrCVbJNjPoxMeVf7QT5g7mQASbTf9Kp4cryvcXnu2qurjWKcrdsr91jXymdCDNxKgLFKJG");
                done();
            })
    });
});

// BIP44 extended public key is shown
it('Shows the extended public key for bip44 tab', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.extended-pub-key'))
            .getAttribute("value")
            .then(function(path) {
                expect(path).toBe("xpub6FDKNRvTTLzDmAdpNTc49ia9b4byd6vqCdUa46Fp3vqMcC96uBoufCmZXQLiN5AK3iSCJMhf9gT2sxkpyaPepRuA7W3MujV5tGmF5VfbueM");
                done();
            })
    });
});

// BIP44 account field changes address list
it('Changes the address list if bip44 account is changed', function(done) {
    driver.findElement(By.css('#bip44 .account'))
        .sendKeys('1');
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("1Nq2Wmu726XHCuGhctEtGmhxo3wzk5wZ1H");
            done();
        });
    });
});

// BIP44 change field changes address list
it('Changes the address list if bip44 change is changed', function(done) {
    driver.findElement(By.css('#bip44 .change'))
        .sendKeys('1');
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("1KAGfWgqfVbSSXY56fNQ7YnhyKuoskHtYo");
            done();
        });
    });
});

// BIP32 derivation path can be set
it('Can use a custom bip32 derivation path', function(done) {
    driver.findElement(By.css('#bip32-tab a'))
        .click();
    driver.findElement(By.css('#bip32 .path'))
        .clear();
    driver.findElement(By.css('#bip32 .path'))
        .sendKeys('m/1');
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("16pYQQdLD1hH4hwTGLXBaZ9Teboi1AGL8L");
            done();
        });
    });
});

// BIP32 can use hardened derivation paths
it('Can use a hardened derivation paths', function(done) {
    driver.findElement(By.css('#bip32-tab a'))
        .click();
    driver.findElement(By.css('#bip32 .path'))
        .clear();
    driver.findElement(By.css('#bip32 .path'))
        .sendKeys("m/0'");
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("14aXZeprXAE3UUKQc4ihvwBvww2LuEoHo4");
            done();
        });
    });
});

// BIP32 extended private key is shown
it('Shows the BIP32 extended private key', function(done) {
    driver.findElement(By.css('#bip32-tab a'))
        .click();
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.extended-priv-key'))
            .getAttribute("value")
            .then(function(privKey) {
                expect(privKey).toBe("xprv9va99uTVE5aLiutUVLTyfxfe8v8aaXjSQ1XxZbK6SezYVuikA9MnjQVTA8rQHpNA5LKvyQBpLiHbBQiiccKiBDs7eRmBogsvq3THFeLHYbe");
                done();
            });
    });
});

// BIP32 extended public key is shown
it('Shows the BIP32 extended public key', function(done) {
    driver.findElement(By.css('#bip32-tab a'))
        .click();
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.extended-pub-key'))
            .getAttribute("value")
            .then(function(pubKey) {
                expect(pubKey).toBe("xpub69ZVZQzP4T8dwPxwbMzz36cNgwy4yzTHmETZMyihzzXXNi3thgg3HCow1RtY252wdw5rS8369xKnraN5Q93y3FkFfJp2XEHWUrkyXsjS93P");
                done();
            });
    });
});

// Derivation path is shown in table
it('Shows the derivation path in the table', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        getFirstPath(function(path) {
            expect(path).toBe("m/44'/0'/0'/0/0");
            done();
        });
    });
});

// Derivation path for address can be hardened
it('Can derive hardened addresses', function(done) {
    driver.findElement(By.css('#bip32-tab a'))
        .click();
    driver.executeScript(function() {
        $(".hardened-addresses").prop("checked", true);
    });
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("18exLzUv7kfpiXRzmCjFDoC9qwNLFyvwyd");
            done();
        });
    });
});

// Derivation path visibility can be toggled
it('Can toggle visibility of the derivation path column', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.index-toggle'))
            .click();
        testColumnValuesAreInvisible(done, "index");
    });
});

// Address is shown
it('Shows the address in the table', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("1Di3Vp7tBWtyQaDABLAjfWtF6V7hYKJtug");
            done();
        });
    });
});

// Addresses are shown in order of derivation path
it('Shows the address in order of derivation path', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        testRowsAreInCorrectOrder(done);
    });
});

// Address visibility can be toggled
it('Can toggle visibility of the address column', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.address-toggle'))
            .click();
        testColumnValuesAreInvisible(done, "address");
    });
});

// Public key is shown in table
it('Shows the public key in the table', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElements(By.css('.pubkey'))
            .then(function(els) {
                els[0].getText()
                    .then(function(pubkey) {
                        expect(pubkey).toBe("033f5aed5f6cfbafaf223188095b5980814897295f723815fea5d3f4b648d0d0b3");
                        done();
                    });
            });
    });
});

// Public key visibility can be toggled
it('Can toggle visibility of the public key column', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.public-key-toggle'))
            .click();
        testColumnValuesAreInvisible(done, "pubkey");
    });
});

// Private key is shown in table
it('Shows the private key in the table', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElements(By.css('.privkey'))
            .then(function(els) {
                els[0].getText()
                    .then(function(pubkey) {
                        expect(pubkey).toBe("L26cVSpWFkJ6aQkPkKmTzLqTdLJ923e6CzrVh9cmx21QHsoUmrEE");
                        done();
                    });
            });
    });
});

// Private key visibility can be toggled
it('Can toggle visibility of the private key column', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.private-key-toggle'))
            .click();
        testColumnValuesAreInvisible(done, "privkey");
    });
});

// More addresses can be generated
it('Can generate more rows in the table', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.more'))
            .click();
        driver.sleep(generateDelay).then(function() {
            driver.findElements(By.css('.address'))
                .then(function(els) {
                    expect(els.length).toBe(40);
                    done();
                });
        });
    });
});

// A custom number of additional addresses can be generated
it('Can generate more rows in the table', function(done) {
    driver.findElement(By.css('.rows-to-add'))
        .clear();
    driver.findElement(By.css('.rows-to-add'))
        .sendKeys('1');
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.more'))
            .click();
        driver.sleep(generateDelay).then(function() {
            driver.findElements(By.css('.address'))
                .then(function(els) {
                    expect(els.length).toBe(21);
                    done();
                });
        });
    });
});

// Additional addresses are shown in order of derivation path
it('Shows additional addresses in order of derivation path', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.more'))
            .click();
        driver.sleep(generateDelay).then(function() {
            testRowsAreInCorrectOrder(done);
        });
    });
});

// BIP32 root key can be set by the user
it('Allows the user to set the BIP32 root key', function(done) {
    driver.findElement(By.css('.root-key'))
        .sendKeys('xprv9s21ZrQH143K2jkGDCeTLgRewT9F2pH5JZs2zDmmjXes34geVnFiuNa8KTvY5WoYvdn4Ag6oYRoB6cXtc43NgJAEqDXf51xPm6fhiMCKwpi');
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("1Di3Vp7tBWtyQaDABLAjfWtF6V7hYKJtug");
            done();
        });
    });
});

// Setting BIP32 root key clears the existing phrase, passphrase and seed
// TODO this doesn't work in selenium with chrome
it('Confirms the existing phrase should be cleared', function(done) {
    if (browser == "chrome") {
        pending("Selenium + Chrome headless bug for alert, see https://stackoverflow.com/q/45242264");
    }
    driver.findElement(By.css('.phrase'))
        .sendKeys('A non-blank but invalid value');
    driver.findElement(By.css('.root-key'))
        .sendKeys('xprv9s21ZrQH143K2jkGDCeTLgRewT9F2pH5JZs2zDmmjXes34geVnFiuNa8KTvY5WoYvdn4Ag6oYRoB6cXtc43NgJAEqDXf51xPm6fhiMCKwpi');
    driver.switchTo().alert().accept();
    driver.findElement(By.css('.phrase'))
    .getAttribute("value").then(function(value) {
        expect(value).toBe("");
        done();
    });
});

// Clearing of phrase, passphrase and seed can be cancelled by user
// TODO this doesn't work in selenium with chrome
it('Allows the clearing of the phrase to be cancelled', function(done) {
    if (browser == "chrome") {
        pending("Selenium + Chrome headless bug for alert, see https://stackoverflow.com/q/45242264");
    }
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.root-key'))
            .clear();
        driver.findElement(By.css('.root-key'))
            .sendKeys('x');
        driver.switchTo().alert().dismiss();
        driver.findElement(By.css('.phrase'))
        .getAttribute("value").then(function(value) {
            expect(value).toBe("abandon abandon ability");
            done();
        });
    });
});

// Custom BIP32 root key is used when changing the derivation path
it('Can set derivation path for root key instead of phrase', function(done) {
    driver.findElement(By.css('#bip44 .account'))
        .sendKeys('1');
    driver.findElement(By.css('.root-key'))
        .sendKeys('xprv9s21ZrQH143K2jkGDCeTLgRewT9F2pH5JZs2zDmmjXes34geVnFiuNa8KTvY5WoYvdn4Ag6oYRoB6cXtc43NgJAEqDXf51xPm6fhiMCKwpi');
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("1Nq2Wmu726XHCuGhctEtGmhxo3wzk5wZ1H");
            done();
        });
    });
});

// Incorrect mnemonic shows error
it('Shows an error for incorrect mnemonic', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon abandon');
    driver.sleep(feedbackDelay).then(function() {
        driver.findElement(By.css('.feedback'))
            .getText()
            .then(function(feedback) {
                expect(feedback).toBe("Invalid mnemonic");
                done();
            });
    });
});

// Incorrect word shows suggested replacement
it('Shows word suggestion for incorrect word', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon abiliti');
    driver.sleep(feedbackDelay).then(function() {
        driver.findElement(By.css('.feedback'))
            .getText()
            .then(function(feedback) {
                var msg = "abiliti not in wordlist, did you mean ability?";
                expect(feedback).toBe(msg);
                done();
            });
    });
});

// Github pull request 48
// First four letters of word shows that word, not closest
// since first four letters gives unique word in BIP39 wordlist
// eg ille should show illegal, not idle
it('Shows word suggestion based on first four chars', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('ille');
    driver.sleep(feedbackDelay).then(function() {
        driver.findElement(By.css('.feedback'))
            .getText()
            .then(function(feedback) {
                var msg = "ille not in wordlist, did you mean illegal?";
                expect(feedback).toBe(msg);
                done();
            });
    });
});

// Incorrect BIP32 root key shows error
it('Shows error for incorrect root key', function(done) {
    driver.findElement(By.css('.root-key'))
        .sendKeys('xprv9s21ZrQH143K2jkGDCeTLgRewT9F2pH5JZs2zDmmjXes34geVnFiuNa8KTvY5WoYvdn4Ag6oYRoB6cXtc43NgJAEqDXf51xPm6fhiMCKwpj');
    driver.sleep(feedbackDelay).then(function() {
        driver.findElement(By.css('.feedback'))
            .getText()
            .then(function(feedback) {
                var msg = "Invalid root key";
                expect(feedback).toBe(msg);
                done();
            });
    });
});

// Derivation path not starting with m shows error
it('Shows error for derivation path not starting with m', function(done) {
    driver.findElement(By.css('#bip32-tab a'))
        .click();
    driver.findElement(By.css('#bip32 .path'))
        .clear();
    driver.findElement(By.css('#bip32 .path'))
        .sendKeys('n/0');
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(feedbackDelay).then(function() {
        driver.findElement(By.css('.feedback'))
            .getText()
            .then(function(feedback) {
                var msg = "First character must be 'm'";
                expect(feedback).toBe(msg);
                done();
            });
    });
});

// Derivation path containing invalid characters shows useful error
it('Shows error for derivation path not starting with m', function(done) {
    driver.findElement(By.css('#bip32-tab a'))
        .click();
    driver.findElement(By.css('#bip32 .path'))
        .clear();
    driver.findElement(By.css('#bip32 .path'))
        .sendKeys('m/1/0wrong1/1');
    driver.findElement(By.css('.phrase'))
        .sendKeys('abandon abandon ability');
    driver.sleep(feedbackDelay).then(function() {
        driver.findElement(By.css('.feedback'))
            .getText()
            .then(function(feedback) {
                var msg = "Invalid characters 0wrong1 found at depth 2";
                expect(feedback).toBe(msg);
                done();
            });
    });
});

// Github Issue 11: Default word length is 15
// https://github.com/iancoleman/bip39/issues/11
it('Sets the default word length to 15', function(done) {
    driver.findElement(By.css('.strength'))
        .getAttribute("value")
        .then(function(strength) {
            expect(strength).toBe("15");
            done();
        });
});

// Github Issue 12: Generate more rows with private keys hidden
// https://github.com/iancoleman/bip39/issues/12
it('Sets the correct hidden column state on new rows', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.private-key-toggle'))
            .click();
        driver.findElement(By.css('.more'))
            .click();
        driver.sleep(generateDelay).then(function() {
            driver.findElements(By.css('.privkey'))
                .then(function(els) {
                    expect(els.length).toBe(40);
                });
            testColumnValuesAreInvisible(done, "privkey");
        });
    });
});

// Github Issue 19: Mnemonic is not sensitive to whitespace
// https://github.com/iancoleman/bip39/issues/19
it('Ignores excess whitespace in the mnemonic', function(done) {
    var doublespace = "  ";
    var mnemonic = "urge cat" + doublespace + "bid";
    driver.findElement(By.css('.phrase'))
        .sendKeys(mnemonic);
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.root-key'))
            .getAttribute("value")
            .then(function(seed) {
                expect(seed).toBe("xprv9s21ZrQH143K3isaZsWbKVoTtbvd34Y1ZGRugGdMeBGbM3AgBVzTH159mj1cbbtYSJtQr65w6L5xy5L9SFC7c9VJZWHxgAzpj4mun5LhrbC");
                done();
            });
    });
});

// Github Issue 23: Part 1: Use correct derivation path when changing tabs
// https://github.com/iancoleman/bip39/issues/23
it('Uses the correct derivation path when changing tabs', function(done) {
    // 1) and 2) set the phrase
    driver.findElement(By.css('.phrase'))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        // 3) select bip32 tab
        driver.findElement(By.css('#bip32-tab a'))
            .click();
        driver.sleep(generateDelay).then(function() {
            // 4) switch from bitcoin to litecoin
            selectNetwork("LTC - Litecoin");
            driver.sleep(generateDelay).then(function() {
                // 5) Check address is displayed correctly
                getFirstAddress(function(address) {
                    expect(address).toBe("LS8MP5LZ5AdzSZveRrjm3aYVoPgnfFh5T5");
                    // 5) Check derivation path is displayed correctly
                    getFirstPath(function(path) {
                        expect(path).toBe("m/0/0");
                        done();
                    });
                });
            });
        });
    });
});

// Github Issue 23 Part 2: Coin selection in derivation path
// https://github.com/iancoleman/bip39/issues/23#issuecomment-238011920
it('Uses the correct derivation path when changing coins', function(done) {
    // set the phrase
    driver.findElement(By.css('.phrase'))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        // switch from bitcoin to clam
        selectNetwork("CLAM - Clams");
        driver.sleep(generateDelay).then(function() {
            // check derivation path is displayed correctly
            getFirstPath(function(path) {
                expect(path).toBe("m/44'/23'/0'/0/0");
                done();
            });
        });
    });
});

// Github Issue 26: When using a Root key derrived altcoins are incorrect
// https://github.com/iancoleman/bip39/issues/26
it('Uses the correct derivation for altcoins with root keys', function(done) {
    // 1) 2) and 3) set the root key
    driver.findElement(By.css('.root-key'))
        .sendKeys("xprv9s21ZrQH143K2jkGDCeTLgRewT9F2pH5JZs2zDmmjXes34geVnFiuNa8KTvY5WoYvdn4Ag6oYRoB6cXtc43NgJAEqDXf51xPm6fhiMCKwpi");
    driver.sleep(generateDelay).then(function() {
        // 4) switch from bitcoin to viacoin
        selectNetwork("VIA - Viacoin");
        driver.sleep(generateDelay).then(function() {
            // 5) ensure the derived address is correct
            getFirstAddress(function(address) {
                expect(address).toBe("Vq9Eq4N5SQnjqZvxtxzo7hZPW5XnyJsmXT");
                done();
            });
        });
    });
});

// Selecting a language with no existing phrase should generate a phrase in
// that language.
it('Generate a random phrase when language is selected and no current phrase', function(done) {
    driver.findElement(By.css("a[href='#japanese']"))
        .click();
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css(".phrase"))
            .getAttribute("value").then(function(phrase) {
                expect(phrase.search(/[a-z]/)).toBe(-1);
                expect(phrase.length).toBeGreaterThan(0);
                done();
            });
    });
});

// Selecting a language with existing phrase should update the phrase to use
// that language.
it('Updates existing phrases when the language is changed', function(done) {
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css("a[href='#italian']"))
            .click();
        driver.sleep(generateDelay).then(function() {
            driver.findElement(By.css(".phrase"))
                .getAttribute("value").then(function(phrase) {
                    // Check only the language changes, not the phrase
                    expect(phrase).toBe("abaco abaco abbaglio");
                    getFirstAddress(function(address) {
                        // Check the address is correct
                        expect(address).toBe("1Dz5TgDhdki9spa6xbPFbBqv5sjMrx3xgV");
                        done();
                    });
                });
        });
    });
});

// Suggested replacement for erroneous word in non-English language
it('Shows word suggestion for incorrect word in non-English language', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys('abaco abaco zbbaglio');
    driver.sleep(feedbackDelay).then(function() {
        driver.findElement(By.css('.feedback'))
            .getText()
            .then(function(feedback) {
                var msg = "zbbaglio not in wordlist, did you mean abbaglio?";
                expect(feedback).toBe(msg);
                done();
            });
    });
});

// Japanese word does not break across lines.
// Point 2 from
// https://github.com/bitcoin/bips/blob/master/bip-0039/bip-0039-wordlists.md#japanese
it('Does not break Japanese words across lines', function(done) {
    driver.findElement(By.css('.phrase'))
        .getCssValue("word-break")
        .then(function(value) {
            expect(value).toBe("keep-all");
            done();
        });
});

// Language can be specified at page load using hash value in url
it('Can set the language from the url hash', function(done) {
    driver.get(url + "#japanese").then(function() {
        driver.findElement(By.css('.generate')).click();
        driver.sleep(generateDelay).then(function() {
            driver.findElement(By.css(".phrase"))
                .getAttribute("value").then(function(phrase) {
                    expect(phrase.search(/[a-z]/)).toBe(-1);
                    expect(phrase.length).toBeGreaterThan(0);
                    done();
                });
        });
    });
});

// Entropy can be entered by the user
it('Allows entropy to be entered', function(done) {
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy'))
        .sendKeys('00000000 00000000 00000000 00000000');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css(".phrase"))
            .getAttribute("value").then(function(phrase) {
                expect(phrase).toBe("abandon abandon ability");
                getFirstAddress(function(address) {
                    expect(address).toBe("1Di3Vp7tBWtyQaDABLAjfWtF6V7hYKJtug");
                    done();
                })
            });
    });
});

// A warning about entropy is shown to the user, with additional information
it('Shows a warning about using entropy', function(done) {
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy-container'))
        .getText()
        .then(function(containerText) {
            var warning = "mnemonic may be insecure";
            expect(containerText).toContain(warning);
            driver.findElement(By.css('#entropy-notes'))
                .findElement(By.xpath("parent::*"))
                .getText()
                .then(function(notesText) {
                    var detail = "flipping a fair coin, rolling a fair dice, noise measurements etc";
                    expect(notesText).toContain(detail);
                    done();
                });
        });
});

// The types of entropy available are described to the user
it('Shows the types of entropy available', function(done) {
    driver.findElement(By.css('.entropy'))
        .getAttribute("placeholder")
        .then(function(placeholderText) {
            var options = [
                "binary",
                "base 6",
                "dice",
                "base 10",
                "hexadecimal",
                "cards",
            ];
            for (var i=0; i<options.length; i++) {
                var option = options[i];
                expect(placeholderText).toContain(option);
            }
            done();
        });
});

// The actual entropy used is shown to the user
it('Shows the actual entropy used', function(done) {
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy'))
        .sendKeys('Not A Very Good Entropy Source At All');
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.entropy-container'))
            .getText()
            .then(function(text) {
                expect(text).toMatch(/Filtered Entropy\s+AedEceAA/);
                done();
            });
    });
});

// Binary entropy can be entered
it('Allows binary entropy to be entered', function(done) {
    testEntropyType(done, "01", "binary");
});

// Base 6 entropy can be entered
it('Allows base 6 entropy to be entered', function(done) {
    testEntropyType(done, "012345", "base 6");
});

// Base 6 dice entropy can be entered
it('Allows base 6 dice entropy to be entered', function(done) {
    testEntropyType(done, "123456", "base 6 (dice)");
});

// Base 10 entropy can be entered
it('Allows base 10 entropy to be entered', function(done) {
    testEntropyType(done, "789", "base 10");
});

// Hexadecimal entropy can be entered
it('Allows hexadecimal entropy to be entered', function(done) {
    testEntropyType(done, "abcdef", "hexadecimal");
});

// Dice entropy value is shown as the converted base 6 value
// ie 123456 is converted to 123450
it('Shows dice entropy as base 6', function(done) {
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy'))
        .sendKeys("123456");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.entropy-container'))
            .getText()
            .then(function(text) {
                expect(text).toMatch(/Filtered Entropy\s+123450/);
                done();
            });
    });
});

// The number of bits of entropy accumulated is shown
it("Shows the number of bits of entropy for 20 bits of binary", function(done) {
    testEntropyBits(done, "0000 0000 0000 0000 0000", "20");
});
it("Shows the number of bits of entropy for 1 bit of binary", function(done) {
    testEntropyBits(done, "0", "1");
});
it("Shows the number of bits of entropy for 4 bits of binary", function(done) {
    testEntropyBits(done, "0000", "4");
});
it("Shows the number of bits of entropy for 1 character of base 6 (dice)", function(done) {
    // 6 in card is 0 in base 6, 0 in base 6 is 2.6 bits (rounded down to 2 bits)
    testEntropyBits(done, "6", "2");
});
it("Shows the number of bits of entropy for 1 character of base 10 with 3 bits", function(done) {
    // 7 in base 10 is 111 in base 2, no leading zeros
    testEntropyBits(done, "7", "3");
});
it("Shows the number of bits of entropy for 1 character of base 10 with 4 bis", function(done) {
    testEntropyBits(done, "8", "4");
});
it("Shows the number of bits of entropy for 1 character of hex", function(done) {
    testEntropyBits(done, "F", "4");
});
it("Shows the number of bits of entropy for 2 characters of base 10", function(done) {
    testEntropyBits(done, "29", "6");
});
it("Shows the number of bits of entropy for 2 characters of hex", function(done) {
    testEntropyBits(done, "0A", "8");
});
it("Shows the number of bits of entropy for 2 characters of hex with 3 leading zeros", function(done) {
    // hex is always multiple of 4 bits of entropy
    testEntropyBits(done, "1A", "8");
});
it("Shows the number of bits of entropy for 2 characters of hex with 2 leading zeros", function(done) {
    testEntropyBits(done, "2A", "8");
});
it("Shows the number of bits of entropy for 2 characters of hex with 1 leading zero", function(done) {
    testEntropyBits(done, "4A", "8");
});
it("Shows the number of bits of entropy for 2 characters of hex with no leading zeros", function(done) {
    testEntropyBits(done, "8A", "8");
});
it("Shows the number of bits of entropy for 2 characters of hex starting with F", function(done) {
    testEntropyBits(done, "FA", "8");
});
it("Shows the number of bits of entropy for 4 characters of hex with leading zeros", function(done) {
    testEntropyBits(done, "000A", "16");
});
it("Shows the number of bits of entropy for 4 characters of base 6", function(done) {
    testEntropyBits(done, "5555", "11");
});
it("Shows the number of bits of entropy for 4 characters of base 6 dice", function(done) {
    // uses dice, so entropy is actually 0000 in base 6, which is 4 lots of
    // 2.58 bits, which is 10.32 bits (rounded down to 10 bits)
    testEntropyBits(done, "6666", "10");
});
it("Shows the number of bits of entropy for 4 charactes of base 10", function(done) {
    // Uses base 10, which is 4 lots of 3.32 bits, which is 13.3 bits (rounded
    // down to 13)
    testEntropyBits(done, "2227", "13");
});
it("Shows the number of bits of entropy for 4 characters of hex with 2 leading zeros", function(done) {
    testEntropyBits(done, "222F", "16");
});
it("Shows the number of bits of entropy for 4 characters of hex starting with F", function(done) {
    testEntropyBits(done, "FFFF", "16");
});
it("Shows the number of bits of entropy for 10 characters of base 10", function(done) {
    // 10 events at 3.32 bits per event
    testEntropyBits(done, "0000101017", "33");
});
it("Shows the number of bits of entropy for a full deck of cards", function(done) {
    // cards are not replaced, so a full deck is not 52^52 entropy which is 296
    // bits, it's 52!, which is 225 bits
    testEntropyBits(done, "ac2c3c4c5c6c7c8c9ctcjcqckcad2d3d4d5d6d7d8d9dtdjdqdkdah2h3h4h5h6h7h8h9hthjhqhkhas2s3s4s5s6s7s8s9stsjsqsks", "225");
});

it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "A",
            filtered: "A",
            type: "hexadecimal",
            events: "1",
            bits: "4",
            words: 0,
            strength: "less than a second",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "AAAAAAAA",
            filtered: "AAAAAAAA",
            type: "hexadecimal",
            events: "8",
            bits: "32",
            words: 3,
            strength: "less than a second - Repeats like \"aaa\" are easy to guess",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "AAAAAAAA B",
            filtered: "AAAAAAAAB",
            type: "hexadecimal",
            events: "9",
            bits: "36",
            words: 3,
            strength: "less than a second - Repeats like \"aaa\" are easy to guess",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "AAAAAAAA BBBBBBBB",
            filtered: "AAAAAAAABBBBBBBB",
            type: "hexadecimal",
            events: "16",
            bits: "64",
            words: 6,
            strength: "less than a second - Repeats like \"aaa\" are easy to guess",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "AAAAAAAA BBBBBBBB CCCCCCCC",
            filtered: "AAAAAAAABBBBBBBBCCCCCCCC",
            type: "hexadecimal",
            events: "24",
            bits: "96",
            words: 9,
            strength: "less than a second",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "AAAAAAAA BBBBBBBB CCCCCCCC DDDDDDDD",
            filtered: "AAAAAAAABBBBBBBBCCCCCCCCDDDDDDDD",
            type: "hexadecimal",
            events: "32",
            bits: "128",
            words: 12,
            strength: "2 minutes",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "AAAAAAAA BBBBBBBB CCCCCCCC DDDDDDDA",
            filtered: "AAAAAAAABBBBBBBBCCCCCCCCDDDDDDDA",
            type: "hexadecimal",
            events: "32",
            bits: "128",
            words: 12,
            strength: "2 days",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "AAAAAAAA BBBBBBBB CCCCCCCC DDDDDDDA EEEEEEEE",
            filtered: "AAAAAAAABBBBBBBBCCCCCCCCDDDDDDDAEEEEEEEE",
            type: "hexadecimal",
            events: "40",
            bits: "160",
            words: 15,
            strength: "3 years",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "AAAAAAAA BBBBBBBB CCCCCCCC DDDDDDDA EEEEEEEE FFFFFFFF",
            filtered: "AAAAAAAABBBBBBBBCCCCCCCCDDDDDDDAEEEEEEEEFFFFFFFF",
            type: "hexadecimal",
            events: "48",
            bits: "192",
            words: 18,
            strength: "centuries",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "7d",
            type: "card",
            events: "1",
            bits: "4",
            words: 0,
            strength: "less than a second",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "ac2c3c4c5c6c7c8c9ctcjcqckcad2d3d4d5d6d7d8d9dtdjdqdkdah2h3h4h5h6h7h8h9hthjhqhkhas2s3s4s5s6s7s8s9stsjsqsks",
            type: "card (full deck)",
            events: "52",
            bits: "225",
            words: 21,
            strength: "centuries",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "ac2c3c4c5c6c7c8c9ctcjcqckcad2d3d4d5d6d7d8d9dtdjdqdkdah2h3h4h5h6h7h8h9hthjhqhkhas2s3s4s5s6s7s8s9stsjsqsks3d",
            type: "card (full deck, 1 duplicate: 3d)",
            events: "53",
            bits: "254",
            words: 21,
            strength: "centuries",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "ac2c3c4c5c6c7c8c9ctcjcqckcad2d3d4d5d6d7d8d9dtdjdqdkdah2h3h4h5h6h7h8h9hthjhqhkhas2s3s4s5s6s7s8s9stsjsqs3d4d",
            type: "card (2 duplicates: 3d 4d, 1 missing: KS)",
            events: "53",
            bits: "254",
            words: 21,
            strength: "centuries",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "ac2c3c4c5c6c7c8c9ctcjcqckcad2d3d4d5d6d7d8d9dtdjdqdkdah2h3h4h5h6h7h8h9hthjhqhkhas2s3s4s5s6s7s8s9stsjsqs3d4d5d6d",
            type: "card (4 duplicates: 3d 4d 5d..., 1 missing: KS)",
            events: "55",
            bits: "264",
            words: 24,
            strength: "centuries",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        // Next test was throwing uncaught error in zxcvbn
        // Also tests 451 bits, ie Math.log2(52!)*2 = 225.58 * 2
        {
            entropy: "ac2c3c4c5c6c7c8c9ctcjcqckcad2d3d4d5d6d7d8d9dtdjdqdkdah2h3h4h5h6h7h8h9hthjhqhkhas2s3s4s5s6s7s8s9stsjsqsksac2c3c4c5c6c7c8c9ctcjcqckcad2d3d4d5d6d7d8d9dtdjdqdkdah2h3h4h5h6h7h8h9hthjhqhkhas2s3s4s5s6s7s8s9stsjsqsks",
            type: "card (full deck, 52 duplicates: ac 2c 3c...)",
            events: "104",
            bits: "499",
            words: 45,
            strength: "centuries",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        // Case insensitivity to duplicate cards
        {
            entropy: "asAS",
            type: "card (1 duplicate: AS)",
            events: "2",
            bits: "9",
            words: 0,
            strength: "less than a second",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "ASas",
            type: "card (1 duplicate: as)",
            events: "2",
            bits: "9",
            words: 0,
            strength: "less than a second",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        // Missing cards are detected
        {
            entropy: "ac2c3c4c5c6c7c8c  tcjcqckcad2d3d4d5d6d7d8d9dtdjdqdkdah2h3h4h5h6h7h8h9hthjhqhkhas2s3s4s5s6s7s8s9stsjsqsks",
            type: "card (1 missing: 9C)",
            events: "51",
            bits: "221",
            words: 18,
            strength: "centuries",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "ac2c3c4c5c6c7c8c  tcjcqckcad2d3d4d  6d7d8d9dtdjdqdkdah2h3h4h5h6h7h8h9hthjhqhkhas2s3s4s5s6s7s8s9stsjsqsks",
            type: "card (2 missing: 9C 5D)",
            events: "50",
            bits: "216",
            words: 18,
            strength: "centuries",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "ac2c3c4c5c6c7c8c  tcjcqckcad2d3d4d  6d7d8d9dtdjd  kdah2h3h  5h6h7h8h9hthjhqhkhas2s3s4s5s6s7s8s9stsjsqsks",
            type: "card (4 missing: 9C 5D QD...)",
            events: "48",
            bits: "208",
            words: 18,
            strength: "centuries",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        // More than six missing cards does not show message
        {
            entropy: "ac2c3c4c5c6c7c8c  tcjcqckcad2d3d4d  6d  8d9d  jd  kdah2h3h  5h6h7h8h9hthjhqhkh  2s3s4s5s6s7s8s9stsjsqsks",
            type: "card",
            events: "45",
            bits: "195",
            words: 18,
            strength: "centuries",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        // Multiple decks of cards increases bits per event
        {
            entropy: "3d",
            events: "1",
            bits: "4",
            bitsPerEvent: "4.34",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "3d3d",
            events: "2",
            bits: "9",
            bitsPerEvent: "4.80",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "3d3d3d",
            events: "3",
            bits: "15",
            bitsPerEvent: "5.01",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "3d3d3d3d",
            events: "4",
            bits: "20",
            bitsPerEvent: "5.14",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "3d3d3d3d3d",
            events: "5",
            bits: "26",
            bitsPerEvent: "5.22",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "3d3d3d3d3d3d",
            events: "6",
            bits: "31",
            bitsPerEvent: "5.28",
        }
    );
});
it("Shows details about the entered entropy", function(done) {
    testEntropyFeedback(done,
        {
            entropy: "3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d",
            events: "33",
            bits: "184",
            bitsPerEvent: "5.59",
            strength: 'less than a second - Repeats like "abcabcabc" are only slightly harder to guess than "abc"',
        }
    );
});

// Entropy is truncated from the left
it('Truncates entropy from the left', function(done) {
    // Truncate from left means 0000 is removed from the start
    // which gives mnemonic 'avocado zoo zone'
    // not 1111 removed from the end
    // which gives the mnemonic 'abstract zoo zoo'
    var entropy  = "00000000 00000000 00000000 00000000";
        entropy += "11111111 11111111 11111111 1111"; // Missing last byte
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy'))
        .sendKeys(entropy);
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css(".phrase"))
            .getAttribute("value").then(function(phrase) {
                expect(phrase).toBe("avocado zoo zone");
                done();
            });
    });
});

// Very large entropy results in very long mnemonics
it('Converts very long entropy to very long mnemonics', function(done) {
    var entropy  = "";
    for (var i=0; i<33; i++) {
        entropy += "AAAAAAAA"; // 3 words * 33 iterations = 99 words
    }
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy'))
        .sendKeys(entropy);
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css(".phrase"))
            .getAttribute("value").then(function(phrase) {
                var wordCount = phrase.split(/\s+/g).length;
                expect(wordCount).toBe(99);
                done();
            });
    });
});

// Is compatible with bip32jp entropy
// https://bip32jp.github.io/english/index.html
// NOTES:
// Is incompatible with:
//     base 20
it('Is compatible with bip32jp.github.io', function(done) {
    var entropy  = "543210543210543210543210543210543210543210543210543210543210543210543210543210543210543210543210543";
    var expectedPhrase = "train then jungle barely whip fiber purpose puppy eagle cloud clump hospital robot brave balcony utility detect estate old green desk skill multiply virus";
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy'))
        .sendKeys(entropy);
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css(".phrase"))
            .getAttribute("value").then(function(phrase) {
                expect(phrase).toBe(expectedPhrase);
                done();
            });
    });
});

// Blank entropy does not generate mnemonic or addresses
it('Does not generate mnemonic for blank entropy', function(done) {
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy'))
        .clear();
    // check there is no mnemonic
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css(".phrase"))
            .getAttribute("value").then(function(phrase) {
                expect(phrase).toBe("");
                // check there is no mnemonic
                driver.findElements(By.css(".address"))
                    .then(function(addresses) {
                        expect(addresses.length).toBe(0);
                        // Check the feedback says 'blank entropy'
                        driver.findElement(By.css(".feedback"))
                            .getText()
                            .then(function(feedbackText) {
                                expect(feedbackText).toBe("Blank entropy");
                                done();
                            });
                    })
            });
    });
});

// Mnemonic length can be selected even for weak entropy
it('Allows selection of mnemonic length even for weak entropy', function(done) {
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.executeScript(function() {
        $(".mnemonic-length").val("18").trigger("change");
    });
    driver.findElement(By.css('.entropy'))
        .sendKeys("012345");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css(".phrase"))
            .getAttribute("value").then(function(phrase) {
                var wordCount = phrase.split(/\s+/g).length;
                expect(wordCount).toBe(18);
                done();
            });
    });
});

// Github issue 33
// https://github.com/iancoleman/bip39/issues/33
// Final cards should contribute entropy
it('Uses as much entropy as possible for the mnemonic', function(done) {
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.findElement(By.css('.entropy'))
        .sendKeys("7S 9H 9S QH 8C KS AS 7D 7C QD 4S 4D TC 2D 5S JS 3D 8S 8H 4C 3C AC 3S QC 9C JC 7H AD TD JD 6D KH 5C QS 2S 6S 6H JH KD 9D-6C TS TH 4H KC 5H 2H AH 2C 8D 3H 5D");
    driver.sleep(generateDelay).then(function() {
        // Get mnemonic
        driver.findElement(By.css(".phrase"))
            .getAttribute("value").then(function(originalPhrase) {
                // Set the last 12 cards to be AS
                driver.findElement(By.css('.entropy'))
                    .clear();
                driver.findElement(By.css('.entropy'))
                    .sendKeys("7S 9H 9S QH 8C KS AS 7D 7C QD 4S 4D TC 2D 5S JS 3D 8S 8H 4C 3C AC 3S QC 9C JC 7H AD TD JD 6D KH 5C QS 2S 6S 6H JH KD 9D-AS AS AS AS AS AS AS AS AS AS AS AS");
                driver.sleep(generateDelay).then(function() {
                    // Get new mnemonic
                    driver.findElement(By.css(".phrase"))
                        .getAttribute("value").then(function(newPhrase) {
                            expect(originalPhrase).not.toEqual(newPhrase);
                            done();
                        });
                });
            });
    });
});

// Github issue 35
// https://github.com/iancoleman/bip39/issues/35
// QR Code support
// TODO this doesn't work in selenium with firefox
// see https://stackoverflow.com/q/40360223
it('Shows a qr code on hover for the phrase', function(done) {
    if (browser == "firefox") {
        pending("Selenium + Firefox bug for mouseMove, see https://stackoverflow.com/q/40360223");
    }
    // generate a random mnemonic
    var generateEl = driver.findElement(By.css('.generate'));
    generateEl.click();
    // toggle qr to show (hidden by default)
    var phraseEl = driver.findElement(By.css(".phrase"));
    phraseEl.click();
    var rootKeyEl = driver.findElement(By.css(".root-key"));
    driver.sleep(generateDelay).then(function() {
        // hover over the root key
        driver.actions().mouseMove(rootKeyEl).perform().then(function() {
            // check the qr code shows
            driver.executeScript(function() {
                return $(".qr-container").find("canvas").length > 0;
            })
            .then(function(qrShowing) {
                expect(qrShowing).toBe(true);
                // hover away from the phrase
                driver.actions().mouseMove(generateEl).perform().then(function() {;
                    // check the qr code hides
                    driver.executeScript(function() {
                        return $(".qr-container").find("canvas").length == 0;
                    })
                    .then(function(qrHidden) {
                        expect(qrHidden).toBe(true);
                        done();
                    });
                });
            });
        });
    });
});

// BIP44 account extendend private key is shown
// github issue 37 - compatibility with electrum
it('Shows the bip44 account extended private key', function(done) {
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css("#bip44 .account-xprv"))
            .getAttribute("value")
            .then(function(xprv) {
                expect(xprv).toBe("xprv9yzrnt4zWVJUr1k2VxSPy9ettKz5PpeDMgaVG7UKedhqnw1tDkxP2UyYNhuNSumk2sLE5ctwKZs9vwjsq3e1vo9egCK6CzP87H2cVYXpfwQ");
                done();
        });
    });
});

// BIP44 account extendend public key is shown
// github issue 37 - compatibility with electrum
it('Shows the bip44 account extended public key', function(done) {
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css("#bip44 .account-xpub"))
            .getAttribute("value")
            .then(function(xprv) {
                expect(xprv).toBe("xpub6CzDCPbtLrrn4VpVbyyQLHbdSMpZoHN4iuW64VswCyEpfjM2mJGdaHJ2DyuZwtst96E16VvcERb8BBeJdHSCVmAq9RhtRQg6eAZFrTKCNqf");
                done();
        });
    });
});

// github issue 40
// BIP32 root key can be set as an xpub
it('Generates addresses from xpub as bip32 root key', function(done) {
    driver.findElement(By.css('#bip32-tab a'))
        .click();
    // set xpub for account 0 of bip44 for 'abandon abandon ability'
    driver.findElement(By.css("#root-key"))
        .sendKeys("xpub6CzDCPbtLrrn4VpVbyyQLHbdSMpZoHN4iuW64VswCyEpfjM2mJGdaHJ2DyuZwtst96E16VvcERb8BBeJdHSCVmAq9RhtRQg6eAZFrTKCNqf");
    driver.sleep(generateDelay).then(function() {
        // check the addresses are generated
        getFirstAddress(function(address) {
            expect(address).toBe("1Di3Vp7tBWtyQaDABLAjfWtF6V7hYKJtug");
            // check the xprv key is not set
            driver.findElement(By.css(".extended-priv-key"))
                .getAttribute("value")
                .then(function(xprv) {
                    expect(xprv).toBe("NA");
                    // check the private key is not set
                    driver.findElements(By.css(".privkey"))
                        .then(function(els) {
                            els[0]
                                .getText()
                                .then(function(privkey) {
                                    expect(xprv).toBe("NA");
                                    done();
                                });
                        });
                });
        });
    });
});

// github issue 40
// xpub for bip32 root key will not work with hardened derivation paths
it('Shows error for hardened derivation paths with xpub root key', function(done) {
    // set xpub for account 0 of bip44 for 'abandon abandon ability'
    driver.findElement(By.css("#root-key"))
        .sendKeys("xpub6CzDCPbtLrrn4VpVbyyQLHbdSMpZoHN4iuW64VswCyEpfjM2mJGdaHJ2DyuZwtst96E16VvcERb8BBeJdHSCVmAq9RhtRQg6eAZFrTKCNqf");
    driver.sleep(feedbackDelay).then(function() {
        // Check feedback is correct
        driver.findElement(By.css('.feedback'))
            .getText()
            .then(function(feedback) {
                var msg = "Hardened derivation path is invalid with xpub key";
                expect(feedback).toBe(msg);
                // Check no addresses are shown
                driver.findElements(By.css('.addresses tr'))
                    .then(function(rows) {
                        expect(rows.length).toBe(0);
                        done();
                    });
            });
    });
});

// github issue 39
// no root key shows feedback
it('Shows feedback for no root key', function(done) {
    // set xpub for account 0 of bip44 for 'abandon abandon ability'
    driver.findElement(By.css('#bip32-tab a'))
        .click();
    driver.sleep(feedbackDelay).then(function() {
        // Check feedback is correct
        driver.findElement(By.css('.feedback'))
            .getText()
            .then(function(feedback) {
                expect(feedback).toBe("Invalid root key");
                done();
            });
    });
});

// Github issue 44
// display error switching tabs while addresses are generating
it('Can change details while old addresses are still being generated', function(done) {
    // Set to generate 199 more addresses.
    // This will take a long time allowing a new set of addresses to be
    // generated midway through this lot.
    // The newly generated addresses should not include any from the old set.
    // Any more than 199 will show an alert which needs to be accepted.
    driver.findElement(By.css('.rows-to-add'))
        .clear();
    driver.findElement(By.css('.rows-to-add'))
        .sendKeys('199');
    // set the prhase
    driver.findElement(By.css('.phrase'))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        // generate more addresses
        driver.findElement(By.css('.more'))
            .click();
        // change tabs which should cancel the previous generating
        driver.findElement(By.css('#bip32-tab a'))
            .click()
        driver.sleep(generateDelay).then(function() {
            driver.findElements(By.css('.index'))
                .then(function(els) {
                    // check the derivation paths have the right quantity
                    expect(els.length).toBe(20);
                    // check the derivation paths are in order
                    testRowsAreInCorrectOrder(done);
                });
        });
    });
});

// Github issue 49
// padding for binary should give length with multiple of 256
// hashed entropy 1111 is length 252, so requires 4 leading zeros
// prior to issue 49 it would only generate 2 leading zeros, ie missing 2
it('Pads hashed entropy with leading zeros', function(done) {
    driver.findElement(By.css('.use-entropy'))
        .click();
    driver.executeScript(function() {
        $(".mnemonic-length").val("15").trigger("change");
    });
    driver.findElement(By.css('.entropy'))
        .sendKeys("1111");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.phrase'))
            .getAttribute("value")
            .then(function(phrase) {
                expect(phrase).toBe("avocado valid quantum cross link predict excuse edit street able flame large galaxy ginger nuclear");
                done();
            });
    });
});

// Github pull request 55
// https://github.com/iancoleman/bip39/pull/55
// Client select
it('Can set the derivation path on bip32 tab for bitcoincore', function(done) {
    testClientSelect(done, {
        selectValue: "0",
        bip32path: "m/0'/0'",
        useHardenedAddresses: "true",
    });
});
it('Can set the derivation path on bip32 tab for multibit', function(done) {
    testClientSelect(done, {
        selectValue: "2",
        bip32path: "m/0'/0",
        useHardenedAddresses: null,
    });
});

// github issue 58
// https://github.com/iancoleman/bip39/issues/58
// bip32 derivation is correct, does not drop leading zeros
// see also
// https://medium.com/@alexberegszaszi/why-do-my-bip32-wallets-disagree-6f3254cc5846
it('Retains leading zeros for bip32 derivation', function(done) {
    driver.findElement(By.css(".phrase"))
        .sendKeys("fruit wave dwarf banana earth journey tattoo true farm silk olive fence");
    driver.findElement(By.css(".passphrase"))
        .sendKeys("banana");
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            // Note that bitcore generates an incorrect address
            // 13EuKhffWkBE2KUwcbkbELZb1MpzbimJ3Y
            // see the medium.com link above for more details
            expect(address).toBe("17rxURoF96VhmkcEGCj5LNQkmN9HVhWb7F");
            done();
        });
    });
});

// github issue 60
// Japanese mnemonics generate incorrect bip32 seed
// BIP39 seed is set from phrase
it('Generates correct seed for Japanese mnemonics', function(done) {
    driver.findElement(By.css(".phrase"))
        .sendKeys("あいこくしん　あいこくしん　あいこくしん　あいこくしん　あいこくしん　あいこくしん　あいこくしん　あいこくしん　あいこくしん　あいこくしん　あいこくしん　あおぞら");
    driver.findElement(By.css(".passphrase"))
        .sendKeys("メートルガバヴァぱばぐゞちぢ十人十色");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css(".seed"))
            .getAttribute("value")
            .then(function(seed) {
                expect(seed).toBe("a262d6fb6122ecf45be09c50492b31f92e9beb7d9a845987a02cefda57a15f9c467a17872029a9e92299b5cbdf306e3a0ee620245cbd508959b6cb7ca637bd55");
                done();
            });
    });
});

// BIP49 official test vectors
// https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki#test-vectors
it('Generates BIP49 addresses matching the official test vectors', function(done) {
    driver.findElement(By.css('#bip49-tab a'))
        .click();
    selectNetwork("BTC - Bitcoin Testnet");
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("2Mww8dCYPUpKHofjgcXcBCEGmniw9CoaiD2");
            done();
        });
    });
});

// BIP49 derivation path is shown
it('Shows the bip49 derivation path', function(done) {
    driver.findElement(By.css('#bip49-tab a'))
        .click();
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('#bip49 .path'))
            .getAttribute("value")
            .then(function(path) {
                expect(path).toBe("m/49'/0'/0'/0");
                done();
            });
    });
});

// BIP49 extended private key is shown
it('Shows the bip49 extended private key', function(done) {
    driver.findElement(By.css('#bip49-tab a'))
        .click();
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.extended-priv-key'))
            .getAttribute("value")
            .then(function(xprv) {
                expect(xprv).toBe("yprvALYB4DYRG6CzzVgzQZwwqjAA2wjBGC3iEd7KYYScpoDdmf75qMRWZWxoFcRXBJjgEXdFqJ9vDRGRLJQsrL22Su5jMbNFeM9vetaGVqy9Qy2");
                done();
            });
    });
});

// BIP49 extended public key is shown
it('Shows the bip49 extended public key', function(done) {
    driver.findElement(By.css('#bip49-tab a'))
        .click();
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.extended-pub-key'))
            .getAttribute("value")
            .then(function(xprv) {
                expect(xprv).toBe("ypub6ZXXTj5K6TmJCymTWbUxCs6tayZffemZbr2vLvrEP8kceTSENtjm7KHH6thvAKxVar9fGe8rgsPEX369zURLZ68b4f7Vexz7RuXsjQ69YDt");
                done();
            });
    });
});

// BIP49 account field changes address list
it('Can set the bip49 account field', function(done) {
    driver.findElement(By.css('#bip49-tab a'))
        .click();
    driver.findElement(By.css('#bip49 .account'))
        .clear();
    driver.findElement(By.css('#bip49 .account'))
        .sendKeys("1");
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("381wg1GGN4rP88rNC9v7QWsiww63yLVPsn");
            done();
        });
    });
});

// BIP49 change field changes address list
it('Can set the bip49 change field', function(done) {
    driver.findElement(By.css('#bip49-tab a'))
        .click();
    driver.findElement(By.css('#bip49 .change'))
        .clear();
    driver.findElement(By.css('#bip49 .change'))
        .sendKeys("1");
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("3PEM7MiKed5konBoN66PQhK8r3hjGhy9dT");
            done();
        });
    });
});

// BIP49 account extendend private key is shown
it('Shows the bip49 account extended private key', function(done) {
    driver.findElement(By.css('#bip49-tab a'))
        .click();
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('#bip49 .account-xprv'))
            .getAttribute("value")
            .then(function(xprv) {
                expect(xprv).toBe("yprvAHtB1M5Wp675aLzFy9TJYK2mSsLkg6mcBRh5DZTR7L4EnYSmYPaL63KFA4ycg1PngW5LfkmejxzosCs17TKZMpRFKc3z5SJar6QAKaFcaZL");
                done();
            });
    });
});

// BIP49 account extendend public key is shown
it('Shows the bip49 account extended public key', function(done) {
    driver.findElement(By.css('#bip49-tab a'))
        .click();
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('#bip49 .account-xpub'))
            .getAttribute("value")
            .then(function(xprv) {
                expect(xprv).toBe("ypub6WsXQrcQeTfNnq4j5AzJuSyVzuBF5ZVTYecg1ws2ffbDfLmv5vtadqdj1NgR6C6gufMpMfJpHxvb6JEQKvETVNWCRanNedfJtnTchZiJtsL");
                done();
            });
    });
});

// Test selecting coin where bip49 is unavailable (eg CLAM)
it('Shows an error on bip49 tab for coins without bip49', function(done) {
    driver.findElement(By.css('#bip49-tab a'))
        .click();
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        selectNetwork("CLAM - Clams");
        // bip49 available is hidden
        driver.findElement(By.css('#bip49 .available'))
            .getAttribute("class")
            .then(function(classes) {
                expect(classes).toContain("hidden");
                // bip49 unavailable is shown
                driver.findElement(By.css('#bip49 .unavailable'))
                    .getAttribute("class")
                    .then(function(classes) {
                        expect(classes).not.toContain("hidden");
                        // check there are no addresses shown
                        driver.findElements(By.css('.addresses tr'))
                            .then(function(rows) {
                                expect(rows.length).toBe(0);
                                // check the derived private key is blank
                                driver.findElement(By.css('.extended-priv-key'))
                                    .getAttribute("value")
                                    .then(function(xprv) {
                                        expect(xprv).toBe('');
                                        // check the derived public key is blank
                                        driver.findElement(By.css('.extended-pub-key'))
                                            .getAttribute("value")
                                            .then(function(xpub) {
                                                expect(xpub).toBe('');
                                                done();
                                            });
                                    });
                            })
                    });
            });
    });
});

// github issue 43
// Cleared mnemonic and root key still allows addresses to be generated
// https://github.com/iancoleman/bip39/issues/43
it('Clears old root keys from memory when mnemonic is cleared', function(done) {
    // set the phrase
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        // clear the mnemonic and root key
        // using selenium .clear() doesn't seem to trigger the 'input' event
        // so clear it using keys instead
        driver.findElement(By.css('.phrase'))
            .sendKeys(Key.CONTROL,"a");
        driver.findElement(By.css('.phrase'))
            .sendKeys(Key.DELETE);
        driver.findElement(By.css('.root-key'))
            .sendKeys(Key.CONTROL,"a");
        driver.findElement(By.css('.root-key'))
            .sendKeys(Key.DELETE);
        driver.sleep(generateDelay).then(function() {
            // try to generate more addresses
            driver.findElement(By.css('.more'))
                .click();
            driver.sleep(generateDelay).then(function() {
                driver.findElements(By.css(".addresses tr"))
                    .then(function(els) {
                        // check there are no addresses shown
                        expect(els.length).toBe(0);
                        done();
                    });
                });
            });
    });
});

// Github issue 95
// error trying to generate addresses from xpub with hardened derivation
it('Shows error for hardened addresses with xpub root key', function(done) {
    driver.findElement(By.css('#bip32-tab a'))
        .click()
    driver.executeScript(function() {
        $(".hardened-addresses").prop("checked", true);
    });
    // set xpub for account 0 of bip44 for 'abandon abandon ability'
    driver.findElement(By.css("#root-key"))
        .sendKeys("xpub6CzDCPbtLrrn4VpVbyyQLHbdSMpZoHN4iuW64VswCyEpfjM2mJGdaHJ2DyuZwtst96E16VvcERb8BBeJdHSCVmAq9RhtRQg6eAZFrTKCNqf");
    driver.sleep(feedbackDelay).then(function() {
        // Check feedback is correct
        driver.findElement(By.css('.feedback'))
            .getText()
            .then(function(feedback) {
                var msg = "Hardened derivation path is invalid with xpub key";
                expect(feedback).toBe(msg);
                done();
            });
    });
});

// Litecoin uses ltub by default, and can optionally be set to xprv
// github issue 96
// https://github.com/iancoleman/bip39/issues/96
// Issue with extended keys on Litecoin
it('Uses ltub by default for litecoin, but can be set to xprv', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys("abandon abandon ability");
    selectNetwork("LTC - Litecoin");
    driver.sleep(generateDelay).then(function() {
        // check the extended key is generated correctly
        driver.findElement(By.css('.root-key'))
            .getAttribute("value")
            .then(function(rootKey) {
                expect(rootKey).toBe("Ltpv71G8qDifUiNesiPqf6h5V6eQ8ic77oxQiYtawiACjBEx3sTXNR2HGDGnHETYxESjqkMLFBkKhWVq67ey1B2MKQXannUqNy1RZVHbmrEjnEU");
                // set litecoin to use ltub
                driver.executeScript(function() {
                    $(".litecoin-use-ltub").prop("checked", false);
                    $(".litecoin-use-ltub").trigger("change");
                });
                driver.sleep(generateDelay).then(function() {
                    driver.findElement(By.css('.root-key'))
                        .getAttribute("value")
                        .then(function(rootKey) {
                            expect(rootKey).toBe("xprv9s21ZrQH143K2jkGDCeTLgRewT9F2pH5JZs2zDmmjXes34geVnFiuNa8KTvY5WoYvdn4Ag6oYRoB6cXtc43NgJAEqDXf51xPm6fhiMCKwpi");
                            done();
                        });
                })
            });
    });
});

// github issue 99
// https://github.com/iancoleman/bip39/issues/99#issuecomment-327094159
// "warn me emphatically when they have detected invalid input" to the entropy field
// A warning is shown when entropy is filtered and discarded
it('Warns when entropy is filtered and discarded', function(done) {
    driver.findElement(By.css('.use-entropy'))
        .click();
    // set entropy to have no filtered content
    driver.findElement(By.css('.entropy'))
        .sendKeys("00000000 00000000 00000000 00000000");
    driver.sleep(generateDelay).then(function() {
        // check the filter warning does not show
        driver.findElement(By.css('.entropy-container .filter-warning'))
            .getAttribute("class")
            .then(function(classes) {
                expect(classes).toContain("hidden");
                // set entropy to have some filtered content
                driver.findElement(By.css('.entropy'))
                    .sendKeys("10000000 zxcvbn 00000000 00000000 00000000");
                driver.sleep(entropyFeedbackDelay).then(function() {
                    // check the filter warning shows
                    driver.findElement(By.css('.entropy-container .filter-warning'))
                        .getAttribute("class")
                        .then(function(classes) {
                            expect(classes).not.toContain("hidden");
                            done();
                        });
                });
            });
    });
});

// Bitcoin Cash address can be set to use bitpay format
it('Can use bitpay format for bitcoin cash addresses', function(done) {
    driver.executeScript(function() {
        $(".use-bitpay-addresses").prop("checked", true);
    });
    driver.findElement(By.css('.phrase'))
        .sendKeys("abandon abandon ability");
    selectNetwork("BCH - Bitcoin Cash");
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("CZnpA9HPmvhuhLLPWJP8rNDpLUYXy1LXFk");
            done();
        });
    });
});

// End of tests ported from old suit, so no more comments above each test now

it('Can generate more addresses from a custom index', function(done) {
    var expectedIndexes = [
        0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,
        40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59
    ];
    driver.findElement(By.css('.phrase'))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        // Set start of next lot of rows to be from index 40
        // which means indexes 20-39 will not be in the table.
        driver.findElement(By.css('.more-rows-start-index'))
            .sendKeys("40");
        driver.findElement(By.css('.more'))
            .click();
        driver.sleep(generateDelay).then(function() {
            // Check actual indexes in the table match the expected pattern
            driver.findElements(By.css(".index"))
                .then(function(els) {
                    expect(els.length).toBe(expectedIndexes.length);
                    var testRowAtIndex = function(i) {
                        if (i >= expectedIndexes.length) {
                            done();
                        }
                        else {
                            els[i].getText()
                                .then(function(actualPath) {
                                    var noHardened = actualPath.replace(/'/g, "");
                                    var pathBits = noHardened.split("/")
                                    var lastBit = pathBits[pathBits.length-1];
                                    var actualIndex = parseInt(lastBit);
                                    var expectedIndex = expectedIndexes[i];
                                    expect(actualIndex).toBe(expectedIndex);
                                    testRowAtIndex(i+1);
                                });
                        }
                    }
                    testRowAtIndex(0);
                });
        });
    });
});

it('Can generate BIP141 addresses with P2WPKH-in-P2SH semanitcs', function(done) {
    // Sourced from BIP49 official test specs
    driver.findElement(By.css('#bip141-tab a'))
        .click();
    driver.findElement(By.css('.bip141-path'))
        .clear();
    driver.findElement(By.css('.bip141-path'))
        .sendKeys("m/49'/1'/0'/0");
    selectNetwork("BTC - Bitcoin Testnet");
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("2Mww8dCYPUpKHofjgcXcBCEGmniw9CoaiD2");
            done();
        });
    });
});

it('Can generate BIP141 addresses with P2WPKH semanitcs', function(done) {
    // This result tested against bitcoinjs-lib test spec for segwit address
    // using the first private key of this mnemonic and default path m/0
    // https://github.com/bitcoinjs/bitcoinjs-lib/blob/9c8503cab0c6c30a95127042703bc18e8d28c76d/test/integration/addresses.js#L50
    // so whilst not directly comparable, substituting the private key produces
    // identical results between this tool and the bitcoinjs-lib test.
    // Private key generated is:
    // L3L8Nu9whawPBNLGtFqDhKut9DKKfG3CQoysupT7BimqVCZsLFNP
    driver.findElement(By.css('#bip141-tab a'))
        .click();
    // Choose P2WPKH
    driver.executeScript(function() {
        $(".bip141-semantics option[selected]").removeAttr("selected");
        $(".bip141-semantics option").filter(function(i,e) {
            return $(e).html() == "P2WPKH";
        }).prop("selected", true);
        $(".bip141-semantics").trigger("change");
    });
    driver.findElement(By.css(".phrase"))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        getFirstAddress(function(address) {
            expect(address).toBe("bc1qfwu6a5a3evygrk8zvdxxvz4547lmpyx5vsfxe9");
            done();
        });
    });
});

it('Shows the entropy used by the PRNG when clicking generate', function(done) {
    driver.findElement(By.css('.generate')).click();
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.entropy'))
            .getAttribute("value")
            .then(function(entropy) {
                expect(entropy).not.toBe("");
                done();
            });
    });
});

it('Shows the index of each word in the mnemonic', function(done) {
    driver.findElement(By.css('.phrase'))
        .sendKeys("abandon abandon ability");
    driver.sleep(generateDelay).then(function() {
        driver.findElement(By.css('.use-entropy'))
            .click();
        driver.findElement(By.css('.word-indexes'))
            .getText()
            .then(function(indexes) {
                expect(indexes).toBe("0, 0, 1");
                done();
            });
    });
});

});
