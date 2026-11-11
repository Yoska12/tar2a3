import React, { useState, useEffect, useCallback } from 'react';
import { useExamStore } from '../store/examStore';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Home, Loader2, AlertCircle, RefreshCw, History, Trash2, AlertTriangle, FileDown, Folder, CheckCircle, XCircle, ChevronDown, Pencil, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getQuestionsByIds, initializeQuestionData, processQuestions, categoryMapping, bankMapping } from '../utils/dataLoader';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ResultsHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFetchingMistakes, setIsFetchingMistakes] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteAllConfirmModal, setShowDeleteAllConfirmModal] = useState(false);
  const [confirmModalContent, setConfirmModalContent] = useState({ title: '', message: '', onConfirm: null });
  const [isFoldersDialogOpen, setIsFoldersDialogOpen] = useState(false);
  const [showExportPdfModal, setShowExportPdfModal] = useState(false);
  const [isRenamingFolder, setIsRenamingFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isImageZoomModalOpen, setIsImageZoomModalOpen] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState('');
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('Login/auth.php?check_session', { credentials: 'include' });
        const data = await response.json();
        if (data && (data.user || data.telegram_id)) {
          setUserInfo(data.user || data);
        }
      } catch (error) { }
    };
    fetchUserInfo();
  }, []);

  // Centralized Arabic phrases for the Export Errors modal and messages
  const exportText = {
    title: 'تصدير ملف الأخطاء',
    description: 'اختر نوع الملف الذي تريد تصديره. الملف المحلول يتضمن الإجابات الصحيحة ويُستخدم للمراجعة، أما الملف غير المحلول فيُستخدم للاختبار الذاتي.',
    solvedButton: 'تصدير مع الحلول',
    unsolvedButton: 'تصدير بدون حلول',
    generating: 'جاري إنشاء ملف PDF... الرجاء الانتظار.',
    success: 'تم إنشاء ملف PDF للأخطاء بنجاح وسيتم تحميله تلقائيًا.',
    noErrors: 'لا توجد أخطاء سابقة لتصديرها.',
    error: 'حدث خطأ أثناء إنشاء ملف PDF. حاول مرة أخرى لاحقًا.'
  };

  const user = useExamStore((state) => state.user);
  const hideHistory = useExamStore((state) => state.hideHistory);
  const reviewPastResult = useExamStore((state) => state.reviewPastResult);
  const initializeExam = useExamStore((state) => state.initializeExam);
  const folders = useExamStore((state) => state.folders);
  const startExamFromFolder = useExamStore((state) => state.startExamFromFolder);
  const deleteFolder = useExamStore((state) => state.deleteFolder);
  const renameFolder = useExamStore((state) => state.renameFolder);
  const removeQuestionFromFolder = useExamStore((state) => state.removeQuestionFromFolder);
  const reverseCategoryMapping = Object.fromEntries(Object.entries(categoryMapping).map(([key, value]) => [value, key]));

  const displayId = user?.id || user?.telegram_id || userInfo?.telegram_id || userInfo?.id || userInfo?.username || '';


  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
    };
    const handleKeyDown = (event) => {
      // F12
      if (event.key === 'F12') {
        event.preventDefault();
      }
      // Ctrl+Shift+I
      if (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'i')) {
        event.preventDefault();
      }
      // Ctrl+C
      if (event.ctrlKey && (event.key === 'C' || event.key === 'c')) {
        event.preventDefault();
      }
      // Ctrl+V
      if (event.ctrlKey && (event.key === 'V' || event.key === 'v')) {
        event.preventDefault();
      }
      // Ctrl+P
      if (event.ctrlKey && (event.key === 'P' || event.key === 'p')) {
        event.preventDefault();
      }
      // Ctrl+S
      if (event.ctrlKey && (event.key === 'S' || event.key === 's')) {
        event.preventDefault();
      }
      // Ctrl +/-, and other zoom keys
      if (event.ctrlKey && ['=', '+', '-'].includes(event.key)) {
        event.preventDefault();
      }
    };

    const handleWheel = (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);


  useEffect(() => {
    initializeQuestionData();
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('Login/get_results.php', { credentials: 'include' });
      const data = await response.json();
      if (response.ok && data.success) {
        setHistory(data.results);
      } else {
        throw new Error(data.error || 'Failed to fetch results history.');
      }
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleReviewExam = async (resultId) => {
    try {
      const response = await fetch(`Login/get_single_result.php?id=${resultId}`, { credentials: 'include' });
      const data = await response.json();
      if (response.ok && data.success) {
        if (!data.result.details || !data.result.details.questions || !data.result.details.userAnswers) {
          toast.error('لا توجد تفاصيل لهذا الاختبار.');
          return;
        }
        reviewPastResult(data.result);
      } else {
        throw new Error(data.error || 'Failed to fetch result details.');
      }
    } catch (err) {
      toast.error(`خطأ في جلب تفاصيل الاختبار: ${err.message}`);
    }
  };

  const openConfirmationModal = (title, message, onConfirm) => {
    setConfirmModalContent({ title, message, onConfirm });
    setShowConfirmModal(true);
  };

  const handleClearAllHistory = () => {
    setShowDeleteAllConfirmModal(true);
  };

  const confirmClearAllHistory = async () => {
    setShowDeleteAllConfirmModal(false);
    setIsClearing(true);
    try {
      const response = await fetch('Login/clear_all_results.php', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setHistory([]);
        toast.success('تم حذف جميع النتائج بنجاح.');
      } else {
        throw new Error(data.error || 'Failed to clear history.');
      }
    } catch (err) {
      toast.error(`خطأ في الحذف: ${err.message}`);
      console.error('Full error details:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const cancelClearAllHistory = () => {
    setShowDeleteAllConfirmModal(false);
  };

  const handleStartMistakesExam = async () => {
    setIsFetchingMistakes(true);
    try {
      const incorrectQuestionsSet = new Set();
      const incorrectQuestions = [];

      [...history].reverse().forEach(result => {
        if (result.details && result.details.questions && result.details.userAnswers) {
          const questions = result.details.questions;
          const userAnswers = result.details.userAnswers;

          const questionsByNum = {};
          questions.forEach(q => {
            if (q.question_number) {
              questionsByNum[String(q.question_number)] = q;
            }
          });

          for (const qNum in userAnswers) {
            if (questionsByNum[qNum]) {
              const q = questionsByNum[qNum];
              const userAnswerIndex = userAnswers[qNum];

              if (userAnswerIndex != null) {
                const isCorrect = q.answer != null && userAnswerIndex == q.answer;
                if (!isCorrect) {
                  // Use a more specific signature including choices to distinguish questions with same text
                  const questionSignature = q.question.trim() + (q.choices ? JSON.stringify(q.choices) : '');

                  if (!incorrectQuestionsSet.has(questionSignature)) {
                    incorrectQuestionsSet.add(questionSignature);
                    // Ensure the question has the bank/type property from the result if missing
                    if (!q.type && result.details.type) {
                      q.type = result.details.type;
                    }
                    incorrectQuestions.push(q);
                  }
                }
              }
            }
          }
        }
      });

      if (incorrectQuestions.length > 0) {
        const processed = processQuestions(incorrectQuestions);
        initializeExam({
          questions: processed,
          examMode: 'single',
          timerMode: 'none',
          examName: 'مراجعة الأخطاء'
        });
        hideHistory();
      } else {
        toast.info('ليس لديك أي أخطاء سابقة لمراجعتها.');
      }
    } catch (error) {
      console.error('Error starting mistakes exam:', error);
      toast.error('حدث خطأ أثناء محاولة بدء اختبار الأخطاء.');
    } finally {
      setIsFetchingMistakes(false);
    }
  };

  const APP_CACHE_BUSTER = typeof window !== 'undefined' && window.__APP_CACHE_BUSTER ? window.__APP_CACHE_BUSTER : (typeof window !== 'undefined' ? (window.__APP_CACHE_BUSTER = Date.now()) : Date.now());

  const getImageUrl = (imagePath, currentQuestion = null) => {
    if (!imagePath) return null;
    let url = imagePath;
    if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://') && !imagePath.startsWith('data:')) {
      let cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
      if (cleanPath.startsWith('Data/')) cleanPath = cleanPath.slice(5);

      const folder = (currentQuestion?.bank || currentQuestion?.category || 'search').replace(/\.json$/, '');

      let imgParam = cleanPath;
      if (cleanPath.startsWith(`${folder}/`)) {
        imgParam = cleanPath;
      } else if (cleanPath.includes('/') && !cleanPath.startsWith('images/')) {
        imgParam = cleanPath;
      } else {
        imgParam = `${folder}/${cleanPath}`;
      }
      url = `/get_image.php?img=${encodeURIComponent(imgParam)}`;
    } else if (url.includes('/Data/')) {
      let clean = url.replace(/^https?:\/\/[^\/]+\/Data\//i, '').split('?')[0];
      url = `/get_image.php?img=${encodeURIComponent(clean)}`;
    }

    if (!url.startsWith('data:') && !url.includes('_v=') && !url.includes('_=')) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}_v=${APP_CACHE_BUSTER}`;
    }
    return url;
  };

  const getBase64ImageWithDimensions = async (url, maxDim = 700, isPng = false) => {
    if (!url) return null;
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            let w = img.naturalWidth || img.width || 400;
            let h = img.naturalHeight || img.height || 300;
            const originalAspect = w / h;

            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            if (!isPng) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, w, h);
            }

            ctx.drawImage(img, 0, 0, w, h);
            const format = isPng ? 'image/png' : 'image/jpeg';
            const dataUrl = canvas.toDataURL(format, isPng ? undefined : 0.7);
            resolve({ dataUrl, width: w, height: h, aspect: originalAspect, format: isPng ? 'PNG' : 'JPEG' });
          } catch (e) {
            console.warn('Canvas conversion error:', e);
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(blob);
      });
    } catch (e) {
      console.warn('Image fetch error:', e);
      return null;
    }
  };

  const normalizeText = (text) => {
    if (typeof text !== 'string') return text || '';
    return text.replace(/\(/g, '（').replace(/\)/g, '）');
  };

  const generatePdfDocument = async ({ title, fileName, groupedQuestions, withSolutions = true, isFolderExport = false }) => {
    const doc = new jsPDF();

    // 1. Load Arabic Amiri Font safely with chunking
    try {
      const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf';
      const fontResponse = await fetch(fontUrl);
      if (fontResponse.ok) {
        const fontBuffer = await fontResponse.arrayBuffer();
        const bytes = new Uint8Array(fontBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        doc.addFileToVFS('Amiri-Regular.ttf', binary);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'bold');
        doc.setFont('Amiri');
      }
    } catch (e) {
      console.warn('Could not load Amiri font for PDF:', e);
    }

    // 2. Load Logo & Watermark with optimized dimensions
    const logoData = await getBase64ImageWithDimensions('/logo1.png', 120, true);
    const watermarkData = await getBase64ImageWithDimensions('/Watermark.png', 300, true);

    // 3. Page decorations
    const addPageDecorations = (page, pageCount) => {
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Border Frame
      doc.setDrawColor('#182335');
      doc.setLineWidth(12);
      doc.rect(0, 0, pageWidth, pageHeight);

      // Watermark with alias to avoid embedding duplicate copies
      if (watermarkData?.dataUrl) {
        const imgWidth = 160;
        const imgHeight = (watermarkData.height / watermarkData.width) * imgWidth;
        const x = (pageWidth - imgWidth) / 2;
        const y = (pageHeight - imgHeight) / 2;
        doc.setGState(new doc.GState({ opacity: 0.04 }));
        doc.addImage(watermarkData.dataUrl, watermarkData.format, x, y, imgWidth, imgHeight, 'WATERMARK_KEY', 'FAST');
        doc.setGState(new doc.GState({ opacity: 1 }));
      }

      // Telegram ID Watermark across page
      if (displayId) {
        try {
          doc.setGState(new doc.GState({ opacity: 0.12 }));
        } catch (e) {}
        doc.setFontSize(13);
        doc.setTextColor(120, 120, 120);
        doc.setFont('Amiri', 'normal');

        const rows = 5;
        const cols = 3;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const gx = (pageWidth / (cols + 1)) * (c + 1);
            const gy = (pageHeight / (rows + 1)) * (r + 1);
            doc.text(String(displayId), gx, gy, { angle: 30, align: 'center' });
          }
        }
        try {
          doc.setGState(new doc.GState({ opacity: 1 }));
        } catch (e) {}
      }

      // Top Header
      doc.setTextColor('#000000');
      doc.setFontSize(18);
      doc.setFont('Amiri', 'bold');
      doc.text(title, pageWidth / 2, 20, { align: 'center' });

      if (logoData?.dataUrl) {
        doc.addImage(logoData.dataUrl, logoData.format, 18, 10, 16, 16, 'LOGO_KEY', 'FAST');
      }

      doc.setFontSize(9);
      doc.setFont('Amiri', 'normal');
      doc.text(new Date().toLocaleDateString('en-GB'), pageWidth - 20, 18, { align: 'right' });

      doc.setLineWidth(0.5);
      doc.setDrawColor(180, 180, 180);
      doc.line(18, 28, pageWidth - 18, 28);

      // Footer
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`${page} / ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    let y = 36;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const printableWidth = pageWidth - margin * 2;
    const lineSpacing = 6;
    const sectionSpacing = 8;
    const passageFontSize = 12;
    const questionFontSize = 11;
    const choiceFontSize = 10;
    const groupTitleFontSize = 12;
    const passageColor = [20, 20, 20];
    const questionColor = [30, 30, 30];
    const defaultChoiceColor = [40, 40, 40];
    const incorrectChoiceColor = [220, 38, 38];
    const correctChoiceColor = [22, 163, 74];
    const separatorColor = [220, 220, 220];
    let questionCounter = 0;

    const checkPageBreak = (neededHeight) => {
      if (y + neededHeight > pageHeight - 20) {
        doc.addPage();
        y = 36;
        return true;
      }
      return false;
    };

    // Process all groups
    for (const group of Object.values(groupedQuestions)) {
      const typeName = (group.type && (bankMapping[group.type] || reverseCategoryMapping[group.type])) || (group.type === 'search' || group.type === 'math1' ? 'بنك الأسئلة (القسم الكمي)' : group.type);
      const examName = group.exam;

      let prettyHeader = typeName || 'أسئلة متنوعة';
      if (examName && examName !== 'اختبار عام' && examName !== typeName && examName !== 'القسم الكمي' && examName !== 'search' && examName !== 'search.json' && examName !== 'math1' && examName !== 'math1.json') {
        prettyHeader = `${typeName} - ${examName}`;
      }

      const headerText = normalizeText(prettyHeader);
      const splitHeaderText = doc.splitTextToSize(headerText, printableWidth);
      const headerHeight = splitHeaderText.length * lineSpacing + 4;

      checkPageBreak(headerHeight + 20);

      doc.setFontSize(groupTitleFontSize);
      doc.setFont('Amiri', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(splitHeaderText, pageWidth - margin, y, { align: 'right' });
      y += headerHeight;

      // Group questions by passage
      const groupedByPassage = new Map();
      group.questions.forEach(item => {
        const passageKey = item.question?.passage || 'no-passage';
        if (!groupedByPassage.has(passageKey)) {
          groupedByPassage.set(passageKey, []);
        }
        groupedByPassage.get(passageKey).push(item);
      });

      for (const [passage, items] of groupedByPassage.entries()) {
        if (passage !== 'no-passage') {
          const passageText = doc.splitTextToSize(normalizeText(passage), printableWidth);
          const passageHeight = passageText.length * lineSpacing + 4;
          checkPageBreak(passageHeight + 15);

          doc.setFontSize(passageFontSize);
          doc.setFont('Amiri', 'bold');
          doc.setTextColor(...passageColor);
          doc.text(passageText, pageWidth - margin, y, { align: 'right' });
          y += passageHeight;
        }

        for (const item of items) {
          questionCounter++;
          const q = item.question;

          // 1. Fetch Question Image (if any)
          let qImgData = null;
          const rawImg = q.image_url || q.image || q.question_image;
          if (rawImg) {
            const resolvedImgUrl = getImageUrl(rawImg, q);
            qImgData = await getBase64ImageWithDimensions(resolvedImgUrl, 700, false);
          }

          // Calculate image rendering size
          let imgRenderWidth = 0;
          let imgRenderHeight = 0;
          const hasImage = !!(qImgData?.dataUrl);

          if (hasImage) {
            const maxImgWidth = Math.min(printableWidth, 140);
            const maxImgHeight = 85;
            const aspect = qImgData.aspect || (qImgData.width / qImgData.height);

            imgRenderWidth = maxImgWidth;
            imgRenderHeight = imgRenderWidth / aspect;

            if (imgRenderHeight > maxImgHeight) {
              imgRenderHeight = maxImgHeight;
              imgRenderWidth = imgRenderHeight * aspect;
            }
          }

          // 2. Question Text / Header: If image exists, only show question number header, otherwise show question text
          let splitQText = [];
          let qTextHeight = 0;

          if (hasImage) {
            const qNumString = `${questionCounter.toLocaleString('ar-EG')} -`;
            splitQText = doc.splitTextToSize(normalizeText(qNumString), printableWidth);
            qTextHeight = splitQText.length * lineSpacing;
          } else if (q.question) {
            const qTextString = `${questionCounter.toLocaleString('ar-EG')} - ${q.question}`;
            splitQText = doc.splitTextToSize(normalizeText(qTextString), printableWidth);
            qTextHeight = splitQText.length * lineSpacing;
          }

          // 3. Choices Height Estimate
          const choices = q.choices || [];
          let choicesHeight = 0;
          choices.forEach((choice) => {
            const choiceStr = normalizeText(choice);
            const splitChoice = doc.splitTextToSize(choiceStr, printableWidth - 10);
            choicesHeight += splitChoice.length * (lineSpacing - 1) + 2;
          });

          const totalBlockHeight = qTextHeight + (hasImage ? imgRenderHeight + 4 : 0) + choicesHeight + sectionSpacing;

          checkPageBreak(Math.min(totalBlockHeight, 100));

          // Render Question Text / Header
          if (qTextHeight > 0) {
            doc.setFontSize(questionFontSize);
            doc.setFont('Amiri', 'bold');
            doc.setTextColor(...questionColor);
            doc.text(splitQText, pageWidth - margin, y, { align: 'right' });
            y += qTextHeight + 2;
          }

          // Render Question Image
          if (hasImage) {
            checkPageBreak(imgRenderHeight + 6);
            const imgX = (pageWidth - imgRenderWidth) / 2;
            try {
              doc.addImage(qImgData.dataUrl, qImgData.format, imgX, y, imgRenderWidth, imgRenderHeight, undefined, 'FAST');
              y += imgRenderHeight + 4;
            } catch (err) {
              console.warn('Could not add question image to PDF:', err);
            }
          }

          // Render Choices
          doc.setFontSize(choiceFontSize);
          doc.setFont('Amiri', 'normal');

          choices.forEach((choice, choiceIndex) => {
            const choiceStr = normalizeText(choice);
            const splitChoice = doc.splitTextToSize(choiceStr, printableWidth - 10);
            const thisChoiceHeight = splitChoice.length * (lineSpacing - 1) + 2;

            checkPageBreak(thisChoiceHeight + 4);

            let correctAnswerIndex = q.answer;
            if (typeof correctAnswerIndex === 'string') {
              correctAnswerIndex = choices.findIndex(c => c === q.answer);
            }
            const isCorrectAnswer = choiceIndex === correctAnswerIndex || choice === q.answer;
            const isUserAnswer = (item.userAnswerIndex !== undefined && item.userAnswerIndex === choiceIndex) || (item.userAnswer === choice);

            if (isFolderExport) {
              if (isCorrectAnswer) {
                doc.setTextColor(...correctChoiceColor);
                doc.setFont('Amiri', 'bold');
              } else {
                doc.setTextColor(...defaultChoiceColor);
                doc.setFont('Amiri', 'normal');
              }
            } else if (withSolutions) {
              if (isUserAnswer && !isCorrectAnswer) {
                doc.setTextColor(...incorrectChoiceColor);
                doc.setFont('Amiri', 'bold');
              } else if (isCorrectAnswer) {
                doc.setTextColor(...correctChoiceColor);
                doc.setFont('Amiri', 'bold');
              } else {
                doc.setTextColor(...defaultChoiceColor);
                doc.setFont('Amiri', 'normal');
              }
            } else {
              doc.setTextColor(...defaultChoiceColor);
              doc.setFont('Amiri', 'normal');
            }

            doc.text(splitChoice, pageWidth - margin, y, { align: 'right' });
            y += thisChoiceHeight;
          });

          y += sectionSpacing / 2;
          doc.setDrawColor(...separatorColor);
          doc.setLineWidth(0.3);
          doc.line(margin, y, pageWidth - margin, y);
          y += sectionSpacing / 2;
        }
      }
    }

    // 4. Apply decorations to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addPageDecorations(i, pageCount);
    }

    doc.save(fileName);
  };

  const handleExportToPdf = async (withSolutions) => {
    setIsGeneratingPdf(true);
    try {
      const incorrectAnswers = [];
      const incorrectQuestionsSet = new Set();

      [...history].reverse().forEach(result => {
        if (result.details && result.details.questions && result.details.userAnswers) {
          const resultBank = result.details.type;
          const questions = result.details.questions;
          const userAnswers = result.details.userAnswers;

          const questionsByNum = {};
          questions.forEach(q => {
            if (q.question_number) {
              questionsByNum[String(q.question_number)] = q;
            }
          });

          for (const qNum in userAnswers) {
            if (questionsByNum[qNum]) {
              const q = questionsByNum[qNum];
              const userAnswerIndex = userAnswers[qNum];

              if (userAnswerIndex != null) {
                const isCorrect = q.answer != null && userAnswerIndex == q.answer;
                if (!isCorrect) {
                  const questionSignature = (q.question || '') + (q.image || q.image_url || '') + (q.choices ? JSON.stringify(q.choices) : '') + String(q.id || '');
                  if (!incorrectQuestionsSet.has(questionSignature)) {
                    const questionBank = q.bank;
                    const definitiveBank = resultBank || questionBank;

                    incorrectAnswers.push({
                      question: q,
                      userAnswer: q.choices && q.choices[userAnswerIndex] !== undefined ? q.choices[userAnswerIndex] : userAnswerIndex,
                      userAnswerIndex: userAnswerIndex,
                      bank: definitiveBank
                    });
                    incorrectQuestionsSet.add(questionSignature);
                  }
                }
              }
            }
          }
        }
      });

      if (incorrectAnswers.length === 0) {
        toast.info(exportText.noErrors);
        setIsGeneratingPdf(false);
        return;
      }

      const groupedByExamAndBank = incorrectAnswers.reduce((acc, item) => {
        const resolvedType = item.bank || item.question.type;
        const groupKey = `${resolvedType || 'N/A'}-${item.question.exam || 'N/A'}`;
        if (!acc[groupKey]) {
          acc[groupKey] = {
            exam: item.question.exam,
            type: resolvedType,
            questions: []
          };
        }
        acc[groupKey].questions.push(item);
        return acc;
      }, {});

      await generatePdfDocument({
        title: 'ملف الأخطاء',
        fileName: 'ملف الأخطاء.pdf',
        groupedQuestions: groupedByExamAndBank,
        withSolutions
      });

      toast.success(exportText.success);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast.error(exportText.error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const exportFolder = async (folderName) => {
    setIsGeneratingPdf(true);
    try {
      const folder = folders[folderName];
      if (!folder || !folder.questions || folder.questions.length === 0) {
        toast.info(exportText.noErrors);
        setIsGeneratingPdf(false);
        return;
      }

      const folderQuestions = folder.questions.map(q => ({
        question: q,
        userAnswer: null,
        bank: q.bank || q.type
      }));

      const groupedByExamAndBank = folderQuestions.reduce((acc, item) => {
        const resolvedType = item.bank || item.question.type;
        const groupKey = `${resolvedType || 'N/A'}-${item.question.exam || 'N/A'}`;
        if (!acc[groupKey]) {
          acc[groupKey] = {
            exam: item.question.exam,
            type: resolvedType,
            questions: []
          };
        }
        acc[groupKey].questions.push(item);
        return acc;
      }, {});

      await generatePdfDocument({
        title: `مجلد: ${folderName}`,
        fileName: `مجلد_${folderName}.pdf`,
        groupedQuestions: groupedByExamAndBank,
        withSolutions: true,
        isFolderExport: true
      });

      toast.success(exportText.success);
    } catch (error) {
      console.error('Error exporting folder to PDF:', error);
      toast.error(exportText.error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDelete = async (resultId) => {
    openConfirmationModal(
      'تأكيد الحذف',
      'هل أنت متأكد من رغبتك في حذف هذه النتيجة؟',
      async () => {
        try {
          const response = await fetch('Login/delete_result.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: resultId }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            setHistory(prevHistory => prevHistory.filter(result => result.id !== resultId));
            toast.success('تم حذف النتيجة بنجاح.');
          } else {
            console.error('Delete failed. Server response:', data);
            throw new Error(data.error || 'Failed to delete result.');
          }
        } catch (err) {
          toast.error(`خطأ في الحذف: ${err.message}`);
          console.error('Full error details:', err);
        }
      }
    );
  };

  const confirmAction = () => {
    if (confirmModalContent.onConfirm) {
      confirmModalContent.onConfirm();
    }
    setShowConfirmModal(false);
  };

  const cancelAction = () => {
    setShowConfirmModal(false);
  };

  const handleConfirmRename = async (oldName) => {
    if (!newFolderName.trim() || newFolderName === oldName) {
      setIsRenamingFolder(null);
      return;
    }
    const result = await renameFolder(oldName, newFolderName.trim());
    if (result === true) {
      toast.success('تم تغيير اسم المجلد بنجاح.');
    } else {
      toast.error(`خطأ في تغيير الاسم: ${result}`);
    }
    setIsRenamingFolder(null);
  };

  return (
    <>
      <style>{`
        /* Custom blue scrollbar */
        ::-webkit-scrollbar { width: 12px; background: #001e3c; }
        ::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%); border-radius: 8px; border: 2px solid #001e3c; }
        ::-webkit-scrollbar-thumb:hover { background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%); }
        ::-webkit-scrollbar-corner { background: #001e3c; }
        html { scrollbar-color: #38bdf8 #001e3c; scrollbar-width: thin; }
      `}</style>
      <div dir="rtl" className="min-h-screen text-slate-300 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <header className="mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent py-2 leading-normal flex items-center gap-3 justify-center sm:justify-start">
                سجل النتائج
              </h1>
              <div className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:gap-2 gap-2">
                <Button onClick={hideHistory} variant="" className="text-orange-400 hover:bg-white/20 bg-white/10 backdrop-blur-sm border border-white/30 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer">
                  <Home className="h-4 w-4 ml-2" />
                  <span>الصفحة الرئيسية</span>
                </Button>
                <Button onClick={() => setIsFoldersDialogOpen(true)} variant="" className="bg-orange-500 hover:bg-orange-600 hover:text-white text-black backdrop-blur-sm border border-white/30 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer">
                  <Folder className="h-4 w-4 ml-2" />
                  <span>المجلدات</span>
                </Button>
                <Button onClick={handleStartMistakesExam} disabled={isClearing || history.length === 0} variant="" className="bg-yellow-500 hover:bg-yellow-600 hover:text-white text-black font-bold backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer">
                  {isFetchingMistakes ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                  <span>{isFetchingMistakes ? 'تحميل...' : 'اختبار الأخطاء'}</span>
                </Button>
                <Button onClick={() => setShowExportPdfModal(true)} disabled={isGeneratingPdf || history.length === 0} variant="" className="bg-[#bb0092ff] hover:bg-[#940074ff] hover:text-white text-black font-bold backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer">
                  {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4 ml-2" />}
                  <span>{isGeneratingPdf ? 'جاري التصدير...' : 'تصدير الأخطاء'}</span>
                </Button>
                <Button onClick={handleClearAllHistory} disabled={isClearing || history.length === 0} variant="" className="col-span-2 bg-red-600 hover:bg-red-700 hover:text-white text-black font-bold backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer">
                  {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 ml-2" />}
                  <span>{isClearing ? 'جاري الحذف...' : 'حذف الكل'}</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Content */}
          {loading && (
            <div className="text-center p-12">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-orange-400" />
              <p className="mt-4 text-lg">جاري تحميل السجل...</p>
            </div>
          )}

          {error && (
            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="p-6 flex items-center gap-4">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <div>
                  <p className="font-bold text-red-400">حدث خطأ</p>
                  <p className="text-slate-300">{error}</p>
                  <Button onClick={fetchHistory} variant="secondary" className="mt-4">
                    <RefreshCw className="h-4 w-4 ml-2" />
                    حاول مرة أخرى
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center p-12 border-2 border-dashed border-slate-700 rounded-2xl mt-8">
              <h2 className="text-2xl font-bold text-slate-100">لا توجد نتائج محفوظة</h2>
              <p className="text-slate-400 mt-2">بعد إكمال اختبار وحفظ نتيجته، ستظهر هنا.</p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="space-y-4">
              {history.map((result) => {
                const categoryKey = result.details?.type;
                const categoryName = categoryKey ? (reverseCategoryMapping[categoryKey] || bankMapping[categoryKey]) : null;
                const examName = result.exam || result.exam_name;

                let cleanExamName = examName;
                if (cleanExamName === 'search.json' || cleanExamName === 'search' || cleanExamName === 'math1.json' || cleanExamName === 'math1') {
                  cleanExamName = 'بنك الأسئلة (القسم الكمي)';
                } else if (cleanExamName) {
                  cleanExamName = cleanExamName.replace(/\.json$/i, '');
                }

                let cleanCategoryName = categoryName;
                if (categoryKey === 'search' || categoryKey === 'math1') {
                  cleanCategoryName = 'بنك الأسئلة (القسم الكمي)';
                }

                let prettyExamName = cleanExamName || cleanCategoryName || 'بنك الأسئلة (القسم الكمي)';
                if (categoryKey === 'tiger_experiment') {
                  prettyExamName = 'تجربة نمر';
                } else if (cleanExamName && cleanCategoryName && cleanExamName !== cleanCategoryName) {
                  prettyExamName = `${cleanExamName} - ${cleanCategoryName}`;
                }

                return (
                  <Card key={result.id} className="bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/40 transition-all">
                    <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <CardTitle className="text-slate-100 text-xl mb-2 sm:mb-0">{prettyExamName}</CardTitle>
                      <span className="text-sm text-slate-400">
                        {new Date(result.created_at + (result.created_at.endsWith('Z') ? '' : ' UTC')).toLocaleString('ar-EG', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 gap-4">
                      <div className="flex items-center gap-4">
                        <p className="text-3xl font-bold text-orange-400">{result.score_percentage}%</p>
                        <p className="text-slate-400">{result.correct_answers} / {result.total_questions} إجابات صحيحة</p>
                      </div>
                      <div className="flex gap-2 self-end sm:self-center">
                        <Button onClick={() => handleReviewExam(result.id)} className="bg-teal-500 hover:bg-teal-600 hover:text-white text-black font-bold backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer">
                          <History className="h-4 w-4 ml-2" />
                          مراجعة
                        </Button>
                        <Button onClick={() => handleDelete(result.id)} variant="" className="bg-red-600 hover:bg-red-700 hover:text-white text-black font-bold backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer">
                          <Trash2 className="h-4 w-4 ml-2" />
                          حذف
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {showExportPdfModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl" onClick={() => setShowExportPdfModal(false)}>
          <div className="bg-[#112240] rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <h3 className="text-xl font-bold text-white mb-5">{exportText.title}</h3>
              <p className="text-slate-300">{exportText.description}</p>
            </div>
            <div className="p-4 flex gap-4">
              <Button onClick={() => { handleExportToPdf(true); setShowExportPdfModal(false); }} className="flex-1 bg-orange-500 hover:bg-orange-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer">
                {exportText.solvedButton}
              </Button>
              <Button onClick={() => { handleExportToPdf(false); setShowExportPdfModal(false); }} className="flex-1 bg-orange-500 hover:bg-orange-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer">
                {exportText.unsolvedButton}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 p-4" dir="rtl" onClick={cancelAction}>
          <div className="bg-[#112240] rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 transition-transform duration-300 hover:scale-110">
                  <AlertTriangle className="h-8 w-8 text-orange-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {confirmModalContent.title}
              </h3>
            </div>
            <div className="p-6 pt-0">
              <div className="flex items-center justify-center text-center mb-8 h-24">
                <p className="text-slate-300 text-base leading-relaxed">
                  {confirmModalContent.message}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row-reverse gap-3">
                <Button
                  onClick={confirmAction}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer"
                >
                  نعم
                </Button>
                <Button
                  onClick={cancelAction}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer"
                >
                  الغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl" onClick={cancelClearAllHistory}>
          <div className="bg-[#112240] rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-slate-700" onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 transition-transform duration-300 hover:scale-110">
                  <AlertTriangle className="h-8 w-8 text-orange-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                تاكيد الحذف
              </h3>
            </div>

            {/* Modal Content */}
            <div className="p-6 pt-0">
              {/* Centered Text Container */}
              <div className="flex items-center justify-center text-center mb-8 h-24">
                <p className="text-slate-300 text-base leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف جميع نتائجك؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row-reverse gap-3">
                {/* Confirm Button (Primary Action) */}
                <Button
                  onClick={confirmClearAllHistory}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer"
                >
                  نعم
                </Button>
                {/* Cancel Button (Secondary Action) */}
                <Button
                  onClick={cancelClearAllHistory}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer"
                >
                  الغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Folders Dialog */}
      {isFoldersDialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4" dir="rtl" onClick={() => setIsFoldersDialogOpen(false)}>
          <div className="rounded-none sm:rounded-lg text-card-foreground shadow-xl bg-[#001625]/70 backdrop-blur-sm border-0 sm:border sm:border-orange-400/20 w-full h-full sm:h-auto sm:max-h-[80vh] sm:max-w-md md:max-w-2xl lg:max-w-4xl sm:mx-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 transition-transform duration-300 hover:scale-110">
                  <Folder className="h-8 w-8 text-orange-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                المجلدات
              </h3>
            </div>
            <div className="p-6 pt-0">
              <div className="space-y-4">
                {Object.values(folders).length === 0 ? (
                  <p className="text-slate-400 text-center">لا توجد مجلدات محفوظة.</p>
                ) : (
                  Object.values(folders).map((folder) => (
                    <Collapsible key={folder.name} className="rounded-lg text-card-foreground shadow-xl bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20">
                      <div className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          {isRenamingFolder === folder.name ? (
                            <input
                              autoFocus
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmRename(folder.name);
                                if (e.key === 'Escape') setIsRenamingFolder(null);
                              }}
                              className="bg-[#001625] text-white border border-orange-400/50 rounded-xl px-3 py-1 text-lg w-full max-w-[200px] outline-none focus:border-orange-400 transition-all font-bold"
                            />
                          ) : (
                            <CollapsibleTrigger asChild>
                              <span className="text-slate-100 text-lg sm:text-xl font-bold cursor-pointer hover:text-amber-300 transition-colors">
                                {folder.name} ({folder.questions.length} أسئلة)
                              </span>
                            </CollapsibleTrigger>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-400 hover:text-amber-300 hover:bg-white/10 rounded-full transition-all cursor-pointer"
                            onClick={() => {
                              if (isRenamingFolder === folder.name) {
                                handleConfirmRename(folder.name);
                              } else {
                                setIsRenamingFolder(folder.name);
                                setNewFolderName(folder.name);
                              }
                            }}
                          >
                            {isRenamingFolder === folder.name ? <CheckCircle className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
                          </Button>
                        </div>
                        <CollapsibleTrigger asChild>
                          <button type="button" className="p-1 text-white hover:bg-white/10 rounded-full cursor-pointer transition-all">
                            <ChevronDown className="h-6 w-6" />
                          </button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="p-4 border-t border-orange-400/20">
                          <div className="flex justify-end gap-2 mb-4">
                            <Button onClick={() => { exportFolder(folder.name); }} disabled={folder.questions.length === 0} className="bg-[#bb0092ff] hover:bg-[#940074ff] hover:text-white text-black font-bold backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer">
                              <History className="h-4 w-4 ml-1 sm:ml-2" />
                              تصدير
                            </Button>
                            <Button onClick={() => { startExamFromFolder(folder.name); hideHistory(); }} disabled={folder.questions.length === 0} className="bg-teal-500 hover:bg-teal-600 hover:text-white text-black font-bold backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer">
                              <History className="h-4 w-4 ml-1 sm:ml-2" />
                              اختبار
                            </Button>
                            <Button onClick={() => openConfirmationModal('تأكيد الحذف', `هل أنت متأكد من رغبتك في حذف مجلد "${folder.name}"؟`, () => deleteFolder(folder.name))} className="bg-red-600 hover:bg-red-700 hover:text-white text-black font-bold backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer">
                              <Trash2 className="h-4 w-4 ml-1 sm:ml-2" />
                              حذف
                            </Button>
                          </div>
                          <div className="space-y-8">
                            {[...folder.questions].sort((a, b) => a.question_number - b.question_number).map((question, index) => (
                              <div key={question.question_number || index} className="relative overflow-hidden rounded-2xl p-6 border-l-4 shadow-lg bg-[#162442ff] border-orange-400">
                                {/* Telegram ID Watermark to prevent leaking */}
                                {displayId && (
                                  <div className="absolute inset-0 flex flex-col justify-around items-center pointer-events-none z-10 overflow-hidden select-none py-4">
                                    {[...Array(3)].map((_, i) => (
                                      <div
                                        key={i}
                                        className={`flex items-center w-full px-6 ${
                                          i === 0 ? 'justify-start' : i === 1 ? 'justify-center' : 'justify-end'
                                        }`}
                                      >
                                        <div
                                          className="text-xs sm:text-sm md:text-base text-gray-400 font-mono"
                                          style={{ transform: 'rotate(-30deg)', opacity: '0.35' }}
                                        >
                                          {displayId}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="flex items-center justify-between mb-4 relative z-20">
                                  <div className="flex items-center gap-1">
                                    <div className="rounded-full py-0 sm:py-0.5 px-1 sm:px-1.5 bg-gray-100">
                                      <span className="font-bold text-lg sm:text-sm text-[#000000]">
                                        <span className="hidden sm:inline">السؤال </span>
                                        {question.question_number}
                                      </span>
                                    </div>
                                    <Badge className="bg-transparent sm:bg-orange-400/10 text-orange-400 rounded-full text-[10px] sm:text-sm font-medium px-1.5 sm:px-2 py-0 sm:py-0.5">
                                      {reverseCategoryMapping[question.category] || question.category}
                                    </Badge>

                                    {(() => {
                                      const bankKey = question.bank || (bankMapping[question.exam] ? question.exam : (bankMapping[question.type] ? question.type : null));
                                      const subExamName = question.exam;

                                      return (
                                        <>
                                          {bankKey && (
                                            <Badge className="bg-transparent sm:bg-blue-400/10 text-blue-400 rounded-full text-[10px] sm:text-sm font-medium px-1.5 sm:px-2 py-0 sm:py-0.5">
                                              {bankMapping[bankKey] || bankKey}
                                            </Badge>
                                          )}
                                          {subExamName && subExamName !== bankKey && (
                                            <Badge className="bg-transparent sm:bg-orange-400/10 text-orange-400 rounded-full text-[10px] sm:text-sm font-medium px-1.5 sm:px-2 py-0 sm:py-0.5">
                                              {subExamName}
                                            </Badge>
                                          )}
                                        </>
                                      )
                                    })()}
                                  </div>
                                  <Button onClick={() => removeQuestionFromFolder(folder.name, question.id, question.type)} variant="ghost" size="icon" className="hover:bg-transparent hover:scale-110 transition-transform cursor-pointer relative z-20">
                                    <Trash2 className="h-5 w-5 text-red-500" />
                                  </Button>
                                </div>

                                {question.passage && (
                                  <div className="mb-6 p-4 backdrop-blur-sm rounded-xl relative z-20">
                                    <div className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">النص:</div>
                                    <div className="text-sm text-slate-100 leading-relaxed">{question.passage}</div>
                                  </div>
                                )}

                                <div className="mb-6 w-full max-w-full min-w-0 relative z-20">
                                  <div className="text-sm font-bold text-orange-400 mb-3">السؤال:</div>
                                  <div className="text-lg font-medium text-slate-100 backdrop-blur-sm rounded-xl p-2 sm:p-4 w-full max-w-full min-w-0 overflow-hidden">
                                    {!(question.image || question.image_url) && (
                                      <div className="break-words overflow-wrap-anywhere">{question.question}</div>
                                    )}
                                    {(question.image || question.image_url) && (
                                      <div className="flex justify-center w-full max-w-full overflow-hidden my-2">
                                        <img
                                          src={getImageUrl(question.image || question.image_url, question)}
                                          alt={`Question ${question.question_number}`}
                                          className="w-full max-w-full h-auto max-h-[70vh] object-contain rounded-lg cursor-zoom-in block mx-auto"
                                          onClick={() => {
                                            setZoomedImageUrl(getImageUrl(question.image || question.image_url, question));
                                            setIsImageZoomModalOpen(true);
                                          }}
                                          onError={(e) => {
                                            const rawSrc = question.image_url || question.image || '';
                                            if (!e.target.dataset.fallbackTried && rawSrc) {
                                              e.target.dataset.fallbackTried = 'true';
                                              let clean = rawSrc.replace(/^https?:\/\/tarqa\.net\/Data\//i, '').split('?')[0];
                                              if (clean.startsWith('images/')) clean = 'search/' + clean;
                                              if (!clean.includes('/')) clean = 'search/images/' + clean;
                                              e.target.src = `/get_image.php?img=${encodeURIComponent(clean)}&_v=${APP_CACHE_BUSTER}`;
                                            }
                                          }}
                                          onDragStart={(e) => e.preventDefault()}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {question.choices && question.choices.length > 0 && (
                                  <div className="mb-6 relative z-20">
                                    <div className="text-sm font-bold text-orange-400 mb-3">الخيارات:</div>
                                    <div className="grid gap-3">
                                      {question.choices.map((choice, choiceIndex) => {
                                        const isCorrectAnswer = question.answer === choiceIndex;

                                        return (
                                          <div
                                            key={choiceIndex}
                                            className={`p-4 rounded-xl border-2 transition-all duration-300 ${isCorrectAnswer ? 'border-green-400' : ''}`}>
                                            <div className="flex items-center gap-3 text-slate-100">
                                              <span className="flex-1 text-base leading-relaxed">{choice}</span>
                                              {isCorrectAnswer && (
                                                <div className="flex items-center gap-1 text-green-600">
                                                  <CheckCircle className="h-5 w-5" />
                                                  <span className="text-sm font-bold">الاجابة الصحيحة</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))
                )}
              </div>
            </div>
            <div className="p-6 pt-0">
              <Button
                onClick={() => setIsFoldersDialogOpen(false)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer"
              >
                اغلاق
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      <Dialog modal={false} open={isImageZoomModalOpen} onOpenChange={setIsImageZoomModalOpen}>
        <DialogContent
          className="max-w-[95vw] md:max-w-4xl lg:max-w-6xl max-h-[90vh] p-0 bg-transparent border-0 relative overflow-hidden flex items-center justify-center"
        >
          <DialogTitle className="sr-only">تكبير الصورة</DialogTitle>
          <DialogDescription className="sr-only">عرض الصورة بحجم مكبر</DialogDescription>
          <DialogClose className="absolute top-3 left-3 z-50 p-2 bg-black/70 hover:bg-black/90 rounded-full text-white cursor-pointer transition-colors shadow-lg">
            <X className="h-6 w-6" />
          </DialogClose>
          {displayId && (
            <div className="absolute inset-0 flex flex-col justify-around items-center pointer-events-none z-20 overflow-hidden select-none py-8">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`flex items-center w-full px-12 ${
                    i === 0 ? 'justify-start' : i === 1 ? 'justify-center' : 'justify-end'
                  }`}
                >
                  <div
                    className="text-xs sm:text-sm md:text-base text-gray-300/60 dark:text-gray-400/40 font-mono"
                    style={{ transform: 'rotate(-30deg)' }}
                  >
                    {displayId}
                  </div>
                </div>
              ))}
            </div>
          )}
          <img
            src={zoomedImageUrl}
            alt="Zoomed Question"
            className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-md relative z-10 block mx-auto shadow-2xl bg-white"
            onDragStart={(e) => e.preventDefault()}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ResultsHistory;