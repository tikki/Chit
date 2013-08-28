# Chit-Chat Design Specs & Thoughts

Before you read anything else about the project, I want to make something *very* clear:

**DO NOT TRUST ME.**
**DO NOT TRUST CHIT.**
**DO NOT TRUST YOUR BROWSER.**
**DO NOT TRUST YOUR OPERATING SYSTEM.**
**DO NOT TRUST YOUR BIOS.**
**DO NOT TRUST YOUR HARDWARE.**

I'm serious.

A *lot* of thought & work went into this project.  I had only the best intentions in mind, I wanted to make the world a better place, make it easier for people to communicate with each other in a secure manner.

But I could be lying right now and you wouldn't know it.  And even if I'm not, I'm sure I missed something; there are probably gaping security holes everywhere, compromising the whole system.  And even if that isn't true either, who knows what else is running on *your* computer.

So if you are thinking about using Chit, please keep that in mind.  There's no magic here, just some applied (potentially broken) cryptography.

## What is Chit

Chit is meant to enable simple & secure chatting.
To achieve this, Chit is broken into two parts.

The first part is the back-end, an application platform.  It specifies message formats, protocols and standards.  It is supposed to offer powerful & easy to use APIs to enable developers to write their own clients and applications.

The second part is the front-end, a web-client using said platform.  It is built using current web technologies to offer a nice user experience.

## Philosophy

### Chit is built with paranoia.

One of the main goals of this project is to make everything as secure as possible.
Although chit uses a classic client-server topology, it **does not** trust the server.  The server is used as a simple relay, storing and distributing blobs of encrypted data to offer persistence.  The worst that should be able to happen is, that your communication is interrupted.

#### Worst case scenario

Under normal circumstances, i.e. without accounting for security problems on your own machine (trojan horses, TEMPEST attacks, etc.), this is the worst that should be able to happen:

- Since you connect to a server, it knows your IP.
- It knows that you sent a message and to what channel, there's no plausible deniability.
- Your messages never reach anybody else.

An attacker owning the network or server can kill all communication.  Nothing can be done about that.  What we can do is ensure integrity and to a certain degree authenticity and validity.

### Chit is built with love.

The other goal of chit is to be as hassle-free as possible while maintaining security.  Fuck OAuth and other passport systems.
With Chit, creating a new chat room is as easy as joining an existing one.  There's no registration, log-in or other nonsense.

### Chit is free.

Freedom is important.  Freedom means, you can host everything yourself.  Freedom means, you can look at the source code and make sure there are no problems with it.  Freedom enables safety.

# Tech

## Terminology

- Message: A message is a JSON encoded `Object` containing text and other parameters.
- Text: Text is a user defined `String`, usually unencrypted (i.e. plaintext).

## Unencrypted Message Format

An unencrypted message is a serialized `Object`, containing the plaintext and other optional elements.

plain-message := {"ts": …, "pt": …, "us": …}

    ts: a UTC timestamp (seconds since 1970-01-01 00:00:00 UTC)
	pt: plaintext
	us: name of the sender

## Encrypted Message Format ("Cipher Message")

A cipher message is a serialized `Object`, containing the ciphertext, the corresponding IV, and other optional elements.

cipher-message := {"iv": …, "ct": encrypted(plain-message), "sg": …}

	iv: IV
	ct: ciphertext (usually contains an encrypted plain-message)
	sg: unique sender ID that will be transformed (usually through HMAC) by the server

To combat message forging from malevolent clients, the server adds his own timestamp to the message and transforms the signature.

server-cipher-message := {"iv": …, "ct": …, "sg": transformed(cipher-message.sg), "ts": …}

## Message unpacking

When a client gets a cipher message, he decrypts the ciphertext and compares the plain-message timestamp against the cipher-message timestamp.  The more these two values diverge, the less trust should be given to the message.  Clocks may be asynchronous or lag times may be high, so differing values will be common place.  But if the two values only differ by a few seconds (let's say less than 3 seconds, that's enough for information to go around the earth 15 times in a copper cable), chances are high the message is genuine and was created with no timestamp forgery in mind.

# Standard Parameters

Although each chat or even each message could in theory use & supply its own set of parameters for the cryptographic functions, we'll decide on some seemingly sane defaults.

All encryption is to be done using AES with a key length of 256 bits.
Because of SJCL's (the crypto library used for the implementation of Chit's default web frontend) very limited amount of available cipher modes (at least by default) we'll run it in CCM (as specified in RFC3610).
Adata shall be an empty string (NOTE: THIS SHOULD ACTUALLY BE SET TO SOMETHING MORE MEANINGFUL, BUT THE CURRENT IMPLEMENTATION HAS IT SET TO AN EMPTY STRING) and the tag-length set to 128, because chat messages are relatively short anyway.
The encryption key is supplied directly, so no PKCS#5/PBKDF2 key derivation needs to happen and we can ignore the salt and amount of iterations.
