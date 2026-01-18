package com.anonymous.galleryapp

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import java.io.File
import java.util.ArrayList

class MultiShareModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val TAG = "MultiShare"

    override fun getName(): String {
        return "MultiShare"
    }

    @ReactMethod
    fun shareImages(uris: ReadableArray, promise: Promise) {
        try {
            val imageUris = ArrayList<Uri>()
            val context = reactApplicationContext
            
            for (i in 0 until uris.size()) {
                val uriString = uris.getString(i)
                if (uriString != null) {
                    try {
                        val uri = Uri.parse(uriString)
                        if (uri.scheme == "file") {
                            // Convert file:// URI to content:// URI using FileProvider
                            val file = File(uri.path)
                            val contentUri = FileProvider.getUriForFile(
                                context,
                                context.packageName + ".provider",
                                file
                            )
                            imageUris.add(contentUri)
                        } else {
                            imageUris.add(uri)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to parse or convert URI: $uriString", e)
                    }
                }
            }

            if (imageUris.isEmpty()) {
                promise.reject("EMPTY_URIS", "No valid URIs provided")
                return
            }

            Log.d(TAG, "Sharing ${imageUris.size} items")

            val shareIntent = Intent().apply {
                if (imageUris.size == 1) {
                    action = Intent.ACTION_SEND
                    putExtra(Intent.EXTRA_STREAM, imageUris[0])
                } else {
                    action = Intent.ACTION_SEND_MULTIPLE
                    putParcelableArrayListExtra(Intent.EXTRA_STREAM, imageUris)
                }
                type = "*/*"
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val activity = reactApplicationContext.currentActivity
            if (activity != null) {
                val chooser = Intent.createChooser(shareIntent, "Share Media")
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                activity.startActivity(chooser)
                promise.resolve(true)
            } else {
                promise.reject("ACTIVITY_NOT_FOUND", "Current activity is null")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Share error", e)
            promise.reject("SHARE_ERROR", e.message, e)
        }
    }
}
