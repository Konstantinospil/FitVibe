#!/bin/sh
# Assert the minimum patched Alpine package versions from the 2026-11-03
# Snyk container report in the final Nginx runtime image.
set -eu

check_package() {
  package="$1"
  minimum="$2"

  installed="$(apk list --installed 2>/dev/null | awk -v pkg="$package" '
    index($1, pkg "-") == 1 {
      print substr($1, length(pkg) + 2)
      exit
    }
  ')"

  if [ -z "$installed" ]; then
    echo "ERROR: required package $package is not installed" >&2
    exit 1
  fi

  comparison="$(apk version -t "$installed" "$minimum")"
  case "$comparison" in
    ">"|"=")
      echo "PASS: $package $installed (minimum $minimum)"
      ;;
    *)
      echo "ERROR: $package $installed is below $minimum (comparison: $comparison)" >&2
      exit 1
      ;;
  esac
}

check_package brotli-libs 1.2.1-r0
check_package libexpat 2.10.0-r0
check_package curl 8.23.0-r0
check_package libcurl 8.23.0-r0
