"use strict";
define({
	cipher: "aes",
	keySize: 256,
	mode: "ccm",
	tagSize: 128,
	adata: "",
	pbkdf2: {
		salt: PUT_A_LONG_UNIQUE_RANDOM_STRING_HERE,
		iterations: PUT_A_LARGE_NUMBER_HERE__AT_LEAST_10000
	}
});
