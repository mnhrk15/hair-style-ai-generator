/**
 * シンプルなファイルアップロード機能
 */
document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const dropContent = document.getElementById('drop-content');
    const uploadProgress = document.getElementById('upload-progress');
    const imagePreview = document.getElementById('image-preview');
    const previewImage = document.getElementById('preview-image');
    const fileName = document.getElementById('file-name');
    const removeButton = document.getElementById('remove-image');
    const generateBtn = document.getElementById('generate-btn');
    const btnText = document.getElementById('btn-text');
    
    let currentFile = null;
    let currentFilePath = null;
    
    // ドロップゾーンのクリックイベント
    dropZone.addEventListener('click', function(e) {
        if (e.target.closest('#image-preview')) return;
        fileInput.click();
    });
    
    // ドラッグ&ドロップイベント
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('border-slate-300', 'bg-slate-50');
    });
    
    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropZone.classList.remove('border-slate-300', 'bg-slate-50');
    });
    
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('border-slate-300', 'bg-slate-50');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
    
    // ファイル選択イベント
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
    
    // ファイル削除イベント
    removeButton.addEventListener('click', function() {
        clearFile();
    });
    
    // ファイル処理
    function handleFile(file) {
        if (!validateFile(file)) {
            return;
        }
        
        currentFile = file;
        showProgress();
        uploadFile(file);
    }
    
    // ファイルバリデーション
    function validateFile(file) {
        const maxSize = window.HairStyleApp.config.maxFileSize;
        const supportedTypes = window.HairStyleApp.config.supportedFormats;
        
        if (file.size > maxSize) {
            showAlert('error', `ファイルサイズが大きすぎます（最大${window.HairStyleApp.config.maxFileSizeMB}MB）`);
            return false;
        }
        
        if (!supportedTypes.includes(file.type)) {
            showAlert('error', '対応していないファイル形式です（JPG, PNG, WebP）');
            return false;
        }
        
        return true;
    }
    
    // プログレス表示
    function showProgress() {
        dropContent.classList.add('hidden');
        imagePreview.classList.add('hidden');
        uploadProgress.classList.remove('hidden');
    }
    
    // ファイルアップロード
    function uploadFile(file) {
        // デバッグログ（開発環境のみ）
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('=== アップロード開始 ===');
            console.log('File:', file);
            console.log('File type:', file.type);
            console.log('File size:', file.size);
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        // FormDataを使用する際は、Content-Typeヘッダーを設定しない
        // ブラウザが自動的に適切なboundaryを含めて設定する
        const config = {
            timeout: 30000  // 30秒タイムアウト
        };
        
        // CSRFトークンを取得（exemptにしているが念のため）
        const csrfToken = document.querySelector('meta[name=csrf-token]');
        if (csrfToken) {
            config.headers = {
                'X-CSRFToken': csrfToken.getAttribute('content')
            };
        }
        
        // デバッグログ（開発環境のみ）
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('Axios config:', config);
        }
        
        axios.post('/upload/', formData, config)
        .then(response => {
            const data = response.data.data;
            currentFilePath = data.file_path;
            
            // generate.jsとの互換性のためwindow.uploadedFileInfoを設定
            window.uploadedFileInfo = {
                path: data.file_path,
                filename: file.name,
                size: file.size,
                type: file.type
            };
            
            // デバッグログ（開発環境のみ）
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('=== アップロード完了 ===');
                console.log('Uploaded file info:', window.uploadedFileInfo);
            }
            
            showPreview(file, data);
            updateGenerateButton();
            showAlert('success', 'ファイルをアップロードしました');
        })
        .catch(error => {
            console.error('Upload error:', error);
            
            if (error.response?.status === 401) {
                showAlert('warning', 'セッションを復旧しています...');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else if (error.response?.data?.error?.includes('セッション')) {
                showAlert('warning', 'セッションエラーを検出。自動復旧中...');
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                showAlert('error', error.response?.data?.error || 'アップロードに失敗しました');
                clearFile();
            }
        });
    }
    
    // プレビュー表示
    function showPreview(file, data) {
        uploadProgress.classList.add('hidden');
        dropContent.classList.add('hidden');
        
        // プレビュー画像設定
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
        
        fileName.textContent = file.name;
        imagePreview.classList.remove('hidden');
    }
    
    // ファイルクリア
    function clearFile() {
        currentFile = null;
        currentFilePath = null;
        
        // generate.jsとの互換性のためwindow.uploadedFileInfoもクリア
        window.uploadedFileInfo = null;
        
        dropContent.classList.remove('hidden');
        uploadProgress.classList.add('hidden');
        imagePreview.classList.add('hidden');
        
        fileInput.value = '';
        updateGenerateButton();
    }
    
    // 生成ボタン更新（統一された状態管理）
    function updateGenerateButton() {
        // 状態を同期
        syncFileState();
        
        // generate.jsが利用可能なら委譲、そうでなければ自前で処理
        if (window.GenerateManager && window.GenerateManager.updateButton) {
            // 少し遅延を入れて状態の同期を確実にする
            setTimeout(() => {
                window.GenerateManager.updateButton();
            }, 10);
        } else {
            // フォールバック：自前処理
            updateButtonFallback();
        }
    }
    
    // 状態同期：currentFileとwindow.uploadedFileInfoの整合性を保つ
    function syncFileState() {
        if (currentFile && currentFilePath && !window.uploadedFileInfo) {
            // currentFileはあるがwindow.uploadedFileInfoがない場合
            window.uploadedFileInfo = {
                path: currentFilePath,
                filename: currentFile.name,
                size: currentFile.size,
                type: currentFile.type
            };
        } else if (!currentFile && window.uploadedFileInfo) {
            // window.uploadedFileInfoはあるがcurrentFileがない場合
            window.uploadedFileInfo = null;
        }
    }
    
    // フォールバック用ボタン更新
    function updateButtonFallback() {
        const hasFile = currentFile !== null;
        const promptInput = document.getElementById('prompt-input');
        const hasPrompt = promptInput && promptInput.value.trim().length > 0;
        
        if (!hasFile) {
            btnText.textContent = '画像をアップロードしてください';
            generateBtn.disabled = true;
        } else if (!hasPrompt) {
            btnText.textContent = '指示を入力してください';
            generateBtn.disabled = true;
        } else {
            btnText.textContent = 'ヘアスタイル生成開始';
            generateBtn.disabled = false;
        }
    }
    
    // プロンプト入力の監視（重複を防ぎつつ確実に動作）
    function setupPromptListener() {
        const promptInput = document.getElementById('prompt-input');
        if (promptInput && !promptInput._uploadListenerAdded) {
            promptInput.addEventListener('input', function() {
                // 短時間遅延してgenerate.jsの処理と競合を避ける
                setTimeout(updateGenerateButton, 5);
            });
            promptInput._uploadListenerAdded = true;
        }
    }
    
    // DOMContentLoaded後にプロンプト監視を設定
    setTimeout(setupPromptListener, 100);
    
    // 外部からのアクセス用
    window.UploadManager = {
        getCurrentFile: () => currentFile,
        getCurrentFilePath: () => currentFilePath,
        clearFile: clearFile
    };
}); 