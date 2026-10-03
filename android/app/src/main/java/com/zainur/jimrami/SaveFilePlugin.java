package com.zainur.jimrami;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    @PluginMethod
    public void saveJson(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");

        if (filename == null || filename.isEmpty()) {
            call.reject("A filename is required.");
            return;
        }

        if (content == null) {
            call.reject("File content is required.");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, filename);

        startActivityForResult(
            call,
            intent,
            "saveJsonResult"
        );
    }

    @ActivityCallback
    private void saveJsonResult(
        PluginCall call,
        ActivityResult result
    ) {
        if (call == null) {
            return;
        }

        if (
            result.getResultCode() != Activity.RESULT_OK ||
            result.getData() == null ||
            result.getData().getData() == null
        ) {
            JSObject cancelled = new JSObject();
            cancelled.put("saved", false);
            call.resolve(cancelled);
            return;
        }

        Uri uri = result.getData().getData();
        String content = call.getString("content", "");

        try (
            OutputStream output =
                getContext()
                    .getContentResolver()
                    .openOutputStream(uri, "w")
        ) {
            if (output == null) {
                call.reject("Could not open the selected file.");
                return;
            }

            output.write(
                content.getBytes(
                    StandardCharsets.UTF_8
                )
            );

            output.flush();

            JSObject response = new JSObject();
            response.put("saved", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject(
                "Could not save the backup.",
                error
            );
        }
    }
}
