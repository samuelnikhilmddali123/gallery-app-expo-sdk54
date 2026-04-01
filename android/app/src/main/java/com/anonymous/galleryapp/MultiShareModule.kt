package com.anonymous.galleryapp

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.io.File

class MultiShareModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "MultiShare"
    }

    /**
     * Android 7+ forbids sharing raw [file://] URIs. Convert local paths to
     * [content://] via [FileProvider]; pass through [content://] as-is.
     */
    private fun resolveShareUri(uriString: String): Uri {
        val trimmed = uriString.trim()
        if (trimmed.isEmpty()) {
            throw IllegalArgumentException("Empty URI")
        }
        val uri = Uri.parse(trimmed)
        val scheme = uri.scheme?.lowercase()

        if (scheme == "content") {
            return uri
        }

        val path = when {
            scheme == "file" -> uri.path
            trimmed.startsWith("/") -> trimmed
            else -> null
        }
        if (path.isNullOrEmpty()) {
            return uri
        }

        val file = File(path)
        if (!file.exists()) {
            throw IllegalArgumentException("File not found: $path")
        }
        if (!file.canRead()) {
            throw IllegalArgumentException("Cannot read file: $path")
        }

        val authority = "${reactApplicationContext.packageName}.fileprovider"
        return FileProvider.getUriForFile(reactApplicationContext, authority, file)
    }

    @ReactMethod
    fun shareImages(uris: ReadableArray, promise: Promise) {
        try {
            val intent = Intent(Intent.ACTION_SEND_MULTIPLE)
            intent.type = "image/*"
            val shareUris = ArrayList<Uri>()

            for (i in 0 until uris.size()) {
                val uriString = uris.getString(i)
                if (uriString != null) {
                    shareUris.add(resolveShareUri(uriString))
                }
            }

            if (shareUris.isEmpty()) {
                promise.reject("SHARE_ERROR", "No URIs to share")
                return
            }

            intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, shareUris)
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

            val chooser = Intent.createChooser(intent, "Share Media")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

            reactApplicationContext.startActivity(chooser)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SHARE_ERROR", e.message, e)
        }
    }
}
