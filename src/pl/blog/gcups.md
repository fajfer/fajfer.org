---
title: Running Green Cell UPS app (GCUPS) on GNU/Linux server
description: There are a lot of people utilizing homelabs or home servers for various things. After I lost some of my data because of power outage somewhere back in 2016 I usually have some kind of backup or at least data duplication.
date: 2023-09-16T12:00:00
author: Damian Fajfer
tags: 
    - devops
    - containers
---

If you're one of these people you probably also want/need an UPS. Since I'm installing a data box I've been searching for an UPS to support the rest of my 11" rack and couldn't really find anything appealing to me on the local market from APC. After some research I realized that I would love to have an exchangeable battery so I've acquired a Green Cell UPS in the process. They advertised a dedicated software that comes with it but it didn't really matter to me until I've discovered that it supports several GNU/Linux distributions.

| | |
|:---:|:---:|
| ![Cosign signature in Artifactory]({{ '/img/blog/gcups/eon.jpg' }}) | ![Cosign signature in Artifactory]({{ '/img/blog/gcups/ups.webp' }}) |
| I like how Green Cell UPS looks similar to the EON from the video game Original War | |

## GC UPS App

On their [download page](https://gcups.greencell.global/en) (edit: or my [GitHub](https://github.com/fajfer/gcups)) they offer gcups (that's how it's called) for all modern desktop systems - Windows, MacOS and, surprisingly, Linux support for .deb, .rpm, .pacman and .tar.gz (with some shell scripts). There's a pretty solid multi-platform choice as they are using Electron running on Chromium. The worst thing is that this software isn't open source.

All in all, Linux support convinced me to give it a try. I'm not going to do much of a review of it. Once I ran some successful tests via webGUI I thought that it could be useful to run it, just not on my desktop. I've tried running gcups with some parameters to demonize it but to no avail. At the time of writing this article I'm using version 1.1.7 released 02.06.2023. Running gcups on my server gave me this output:

```bash
$ gcups 
[371031:0915/014627.729749:ERROR:ozone_platform_x11.cc(240)] Missing X server or $DISPLAY
[371031:0915/014627.729793:ERROR:env.cc(255)] The platform failed to initialize.  Exiting.
Segmentation fault (core dumped)
```

| |
|:---:|
| ![Cosign signature in Artifactory]({{ '/img/blog/gcups/gc-odp.png' }}) |
| Support replying to me that there is no way to run gcups without the GUI, let's prove them wrong |

## Running gcups in CLI environment

Searching for some information on running gcups didn't get me anywhere (version 1.0.0 was published in June 2022) so I started tinkering a bit. Even if I went as far (or as near) as getting this running without X server I'd still need to enable HTTP server in the application settings. I've been doing the usual stuff but I didn't notice any new processes starting up if I enable the web server, `strings` didn't give me any insightful output non-specific to Chromium, I couldn't find anything in the `~/.config/gcups` either. There is also an `/opt/gcups` directory being created during the install so I've eventually began searching in the db folder and - hooray - this was the place.

```bash
/opt/gcups/db$ ls
gcups-rxdb-0-                                                           gcups-rxdb-0-scheduler-mrview-c37be66b94b0bdae91ef3fcbeab58edf
gcups-rxdb-0-device_parameters                                          gcups-rxdb-0-settings-local
gcups-rxdb-0-device_parameters-local                                    gcups-rxdb-0-test
gcups-rxdb-0-device_parameters-mrview-99560a34de60f5074dcd2be42069d585  gcups-rxdb-0-test-local
gcups-rxdb-0-register                                                   gcups-rxdb-0-test-measurement
gcups-rxdb-0-register-local                                             gcups-rxdb-0-test-measurement-local
gcups-rxdb-0-register-mrview-692a6698c32319395128b449dfae271e           gcups-rxdb-0-test-measurement-mrview-99560a34de60f5074dcd2be42069d585
gcups-rxdb-0-_rxdb_internal                                             gcups-rxdb-0-test-mrview-8b2440dfbb354345cc5c69a011a2beb9
gcups-rxdb-0-scheduler                                                  gcups-rxdb-0-test-mrview-8b851648c605dcf349b861f65fdffef5
gcups-rxdb-0-scheduler-local                                            gcups-rxdb-1-settings  <--- this is the one that's interesting to us
gcups-rxdb-0-scheduler-mrview-2f6b156c4b77dd00407dbed941ee1abf          pouch__all_dbs__
```

I've accessed gcups-rxdb-1-settings database using LevelDB via python:

```python3
import plyvel
db = plyvel.DB('/opt/gcups/db/gcups-rxdb-1-settings')

for key, value in db:
    print(f"{key.decode()}: {value.decode()}")
```

Which gives us an interesting output:

```
ÿby-sequenceÿ0000000000000001: {"api":{"port":8080,"password":"password hash here","enable":true,"salt":"password salt here"},"_attachments":{},"_id":"a733f0a7-4fe2-4120-8603-775370fd871a","_rev":"12-c2e2e2d475614a9aed42806e63a38338"}
```

To break up the most interesting parts:

- **port** is pretty obvious, this is just an HTTP port for our webserver
- **enable** tells us if the HTTP server is enabled by default on gcups run

What I found is that you can actually just replace the first and only sequence for gcups to work. There's a (4th from the end) key called `document-store` which stores all revs of the previous sequences as well as the `winningRev` but only the `seq` value matters in this case, which is in most cases your last `by-sequence`.

## Generating your own by-sequence

Now that we know how to access gcups settings without running the gcups itself we need to replace port (optionally), enabled, password and salt. I don't know how to generate salt and password by hand so I'd recommend installing gcups locally, configuring it and then exporting this setting to your server. **Keep in mind, that you can't change your password from the webGUI**. To do this simply install gcups locally, set the password up and enable HTTP server in the settings. Afterwards proceed to `/opt/gcups/db/gcups-rxdb-1-settings` and perform PUT on your data: 

```python3
import plyvel
db = plyvel.DB('/opt/gcups/db/gcups-rxdb-1-settings')

db.put(b'\xc3\xbfby-sequence\xc3\xbf0000000000000001', b'{"api":{"port":8080,"password":"password hash here","enable":true,"salt":"password salt here"},"_attachments":{},"_id":"a733f0a7-4fe2-4120-8603-775370fd871a","_rev":"12-c2e2e2d475614a9aed42806e63a38338"}')
```

You don't need to do anything else now. I've mimicked xserver by using `xvfb` and it enables you to run gcups on your server this way:

`xvfb-run gcups`

Afterwards, you can access your gcups webGUI on the `host:port` on your server you specified in the `by-sequence`

## Closing thoughts

I've contacted the support two times to confirm that the software is not supposed to work without GUI. There is going to be a purely cli solution for gcups and it's on the Green Cell's roadmap but it is unknown when it's going to be released which made me spend one evening trying to run it non-intended way.

I'm thinking about containerization of the complete solution sometime this year, I will update the blogpost afterwards and provide a ready docker-compose with USB passthrough to the container (UPS connects via USB to the machine for gcups to be functional). It would be cool if I also learned how to generate pass/salt combination for gcups as I haven't given it much thought.

And last but not least - there is no point for such software to **NOT** be free software. The only meaningful thing this would expose would be communication scheme between the software and the UPS. So what? Every UPS manufacturer communicates to his UPS in a different way as there is no general protocol on how it should be done. I don't think that it's much of a secret and that it eventually couldn't be exposed with some work anyway. Even if gcups would be free and people decided to use non-Green Cell developed solutions it would still be beneficial for Green Cell as, because of the different communication schemes, these 3rd party solutions would still only support their product. 

Now that it's closed source my work was focused on bypassing xserver requirement instead of making their product better and their product wouldn't exist if not for open source anyway.

## UPDATE 03.04.2024

Hey guys! Motivated by comments from Robert I managed to dockerize the above solution. There's still some work but I'm willing to take it on and maintain the project.

https://github.com/fajfer/gcups

`docker pull ghcr.io/fajfer/gcups:1.1.7`

## UPDATE 19.08.2024

Due to popular demand I've created a Matrix chat room so I can aid you at a whim (or a bit later) - https://matrix.to/#/#gcups:fsfe.org

<meta name="fediverse:creator" content="@fajfer@mastodon.social">
