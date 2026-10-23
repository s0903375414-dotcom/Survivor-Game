package com.survivor.game;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 本機插件：APK 自動更新（版本檢查 / 下載 / 呼叫系統安裝器）
        registerPlugin(AppUpdatePlugin.class);
    }
}
