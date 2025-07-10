---
title: Cosign signatures lifecycle in Artifactory
description: In this article, we will explore the process of signing Docker containers using Cosign and signatures lifecycle in Artifactory docker registry.
date: 2023-07-23T12:00:00
author: Damian Fajfer
tags: 
    - blog
    - devops
    - ansible
    - artifactory
    - cosign
    - docker
---

Additionally, we'll delve into a proposed solution for copying the signature to a target repository during artifact promotion or copying phases, addressing potential challenges in the process.

Details regarding signing and verifying docker containers won't be covered in this blog post. This has been very well explained in other people blog posts[^signing], as well as in the official documentation[^docs-signing][^docs-verifying]. It's safe to say that it works since at least 2021.

## Working with Artifactory

Before going on with signing we need to authenticate ourselves to the docker registry. I'm using Artifactory docker registry[^artifactory] as an example in this scenario.
```bash
{% raw %}cosign login -u {{ username }} -p '{{ password }}' x.artifactory.com
{% endraw %}
```
Cosign could return an error if you provide an URL with the schema:

```
Error: registries must be valid RFC 3986 URI authorities: https://x.artifactory.com
main.go:74: error during command execution: registries must be valid RFC 3986 URI authorities: https://x.artifactory.com
```
As a solution simply omit the schema (https:// in the above example).

When cosign has successfully logged in, build and push the image as usual. Afterwards, you should sign your docker image using cosign sign. If you did everything right to this point, executing cosign verify as a sanity check on the same machine will provide the following output:

```bash
$ cosign verify --key cosign.pub x.artifactory.com/fajfer/image:example
The following checks were performed on these signatures:
  - The cosign claims were validated
  - The signatures were verified against the specified public key
{"Critical":{"Identity":{"docker-reference":""},"Image":{"Docker-manifest-digest":"sha256:87ef60f558bad79beea6425a3b28989f01dd417164150ab3baab98dcbf04def8"},"Type":"cosign container image signature"},"Optional":null}
```

You can repeat the command on a different machine to verify that the signature has been successfully uploaded. The output should remain the same and the signature should be visible in the webUI:

![Cosign signature in Artifactory]({{ '/img/blog/cosign-artifactory/sig.png' }})

## So what's the problem?

As per documentation:

Cosign documentation @ af555d5
```
Signatures are stored as separate objects in the OCI registry, with only a weak reference back to the object they "sign". This means this relationship is opaque to the registry, and signatures will not be deleted or garbage-collected when the image is deleted. Similarly, they can easily be copied from one environment to another, but this is not automatic.
```

If your artifact lifecycle ends here and images from here are being deployed to production or are available to public then that's it, you're done. Otherwise, if you want to promote your images or copy them somewhere else then you'll notice that while your artifacts are getting promoted to the target repository, their signatures are left intact in the source repository. Which means that if you build and sign artifacts in the repository x, then after promoting it to repository y cosign will give you this sad response:

```bash
$ cosign verify --key cosign.pub y.artifactory.com/fajfer/image:example
Error: no matching signatures:

main.go:52: error during command execution: no matching signatures:
```

What's wrong, right? It just worked perfectly in the old repository.

## The proposed solution

We need to copy the signature to the target repository. After the Promote Docker Image REST API request we need to do a Copy Item request to copy the signature. There's an important detail here - cosign names the signature after SHA256 of manifest.json of our image. Luckily, we can easily access that information by executing File Info request. We can also calculate this ourselves but I assume you don't have the image locally anymore during the promotion/copy phase.

![Digest field under 'Docker Info' in the UI also displays the hash]({{ '/img/blog/cosign-artifactory/example.png' }})

To understand the solution better and get an idea of how your requests should look like, here's an example in Ansible code that could be used to implement a solution in your CI system:

```yaml
{% raw %}- name: Promote Docker Image
  # https://jfrog.com/help/r/jfrog-rest-apis/promote-docker-image
  uri:
    url: "{{ artifactory_url }}/api/docker/{{ source_repo }}/v2/promote"
    method: POST
    url_username: "{{ username }}"
    url_password: "{{ password }}"
    force_basic_auth: true
    body_format: json
    body:
      targetRepo: "{{ target_repo }}"
      dockerRepository: "{{ docker_repository }}"
      copy: true

- name: Get manifest.json (File Info)
  # https://jfrog.com/help/r/jfrog-rest-apis/file-info
  uri:
    url: "{{ artifactory_url }}/api/storage/{{ source_repo }}/\
      {{ file_path }}/{{ tag }}/manifest.json"
    method: GET
    url_username: "{{ username }}"
    url_password: "{{ password }}"
    force_basic_auth: true
  register: manifest

- name: Copy cosign signature (Copy Item)
  # https://jfrog.com/help/r/jfrog-rest-apis/copy-item
  uri:
    url: "{{ artifactory_url }}/api/copy/{{ source_repo }}/\
      {{ source_file_path }}/sha256-{{ manifest.json.checksums.sha256 }}.sig\
      ?to=/{{ target_repo }}/{{ target_file_path }}"
    method: POST
    url_username: "{{ username }}"
    url_password: "{{ password }}"
    force_basic_auth: true
{% endraw %}
```

This approach makes the best use of Artifactory's API and doesn't require the image and signature to be downloaded locally at all.

## Closing thoughts

Cosign support of Artifactory is very well done and the Artifactory knows that it serves you signed images as it sends you a signature along with the container after executing docker pull. The API doesn't reflect that though, but that's hopefully going to change in the future. Container signing becomes more popular and more accessible thanks to tools like cosign, notary and kyverno to name a few so doing workarounds like this shouldn't be required in the future.

[^signing]: Jabar Asadi, "Digital Signature With Cosign" May 4, 2023. https://eng.d2iq.com/blog/digital-signature-with-cosign/ Accessed 22.07.2023

[^docs-signing]: Sigstore, "Signing Containers" https://docs.sigstore.dev/cosign/signing_with_containers/ GitHub: 18b11e2

[^docs-verifying]: Sigstore, "Verifying" https://docs.sigstore.dev/cosign/verify GitHub: 4186c93

[^artifactory]: JFrog Artifactory Documentation, "Docker Registry" https://jfrog.com/help/r/jfrog-artifactory-documentation/docker-registry Accessed: 23.07.2023
