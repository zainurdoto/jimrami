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

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    private static final String TEMP_KEY = "backupTempName";

    @PluginMethod
    public void saveJson(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");

        if (filename == null || filename.trim().isEmpty()) {
            call.reject("A filename is required.");
            return;
        }
        if (content == null) {
            call.reject("File content is required.");
            return;
        }

        File temp = null;
        try {
            // Stage the backup before Android opens another activity.
            temp = File.createTempFile("jimrami-backup-", ".json", getContext().getCacheDir());
            try (OutputStream output = new FileOutputStream(temp)) {
                output.write(content.getBytes(StandardCharsets.UTF_8));
            }

            // Capacitor retains PluginCall while the document picker is open.
            // Do not retain the potentially large JSON in that call.
            call.getData().remove("content");
            call.getData().put(TEMP_KEY, temp.getName());

            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, filename);
            startActivityForResult(call, intent, "saveJsonResult");
        } catch (Exception error) {
            if (temp != null) temp.delete();
            call.reject("Could not open the backup save picker.", error);
        }
    }

    @ActivityCallback
    private void saveJsonResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        String tempName = call.getString(TEMP_KEY);
        if (tempName == null || !tempName.startsWith("jimrami-backup-")) {
            call.reject("Temporary backup was not found.");
            return;
        }
        File temp = new File(getContext().getCacheDir(), tempName);

        if (result.getResultCode() != Activity.RESULT_OK ||
            result.getData() == null || result.getData().getData() == null) {
            temp.delete();
            JSObject response = new JSObject();
            response.put("saved", false);
            call.resolve(response);
            return;
        }

        Uri uri = result.getData().getData();
        // Some storage providers are slow. Do not block Android's UI thread.
        new Thread(() -> {
            try (InputStream input = new FileInputStream(temp);
                 OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
                if (output == null) throw new Exception("Could not open selected file.");
                byte[] buffer = new byte[32768];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                }
                output.flush();
                JSObject response = new JSObject();
                response.put("saved", true);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Could not save the backup.", error);
            } finally {
                temp.delete();
            }
        }, "JimramiBackupWriter").start();
    }
}
