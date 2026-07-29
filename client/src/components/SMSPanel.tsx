import React, { useState, useEffect, useMemo } from 'react';
import {
    Send,
    Users,
    MessageSquare,
    CheckCircle2,
    AlertCircle,
    Trash2,
    FileText,
    Zap,
    Layout,
    History,
    Copy,
    Info,
    Wand2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

interface SMSTemplate {
    id: string;
    name: string;
    content: string;
}

interface SMSLog {
    id: string;
    timestamp: string;
    recipientCount: number;
    message: string;
    status: 'success' | 'partial' | 'error';
    details?: any;
}

const TEMPLATES: SMSTemplate[] = [
    { id: '1', name: 'Hoş Geldin Bonusu', content: 'Sayın [NAME], %100 Hoş Geldin Bonusunuz hesabınıza tanımlanmıştır. Hemen kazancın keyfini çıkarın! [URL]' },
    { id: '2', name: 'Kayıp Bonusu', content: 'Üzülmeyin! Haftalık %20 Discount bonusunuz yüklenmiştir. Şansınız bol olsun! [URL]' },
    { id: '3', name: 'Haftasonu Özel', content: 'Haftasonuna özel dev oranlar ve sürpriz hediyeler sizi bekliyor. Kaçırmayın! [URL]' },
    { id: '4', name: 'Hızlı Giriş', content: 'Sitemize giriş yapmak için yeni adresimiz: [URL]. Şans sizinle olsun!' },
];

export const SMSPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'send' | 'history' | 'templates'>('send');
    const [phoneList, setPhoneList] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [history, setHistory] = useState<SMSLog[]>([]);

    // LocalStorage'dan geçmişi yükle
    useEffect(() => {
        const saved = localStorage.getItem('sms_history');
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch (e) {
                console.error('Geçmiş yüklenemedi', e);
            }
        }
    }, []);

    // Geçmişi kaydet
    useEffect(() => {
        localStorage.setItem('sms_history', JSON.stringify(history));
    }, [history]);

    const stats = useMemo(() => {
        const phones = phoneList.split(/[\n,]+/).map(p => p.trim()).filter(p => p.length > 0);
        const charCount = message.length;
        const smsCount = Math.ceil(charCount / 160) || 1;
        const totalSms = phones.length * smsCount;
        return { phones, charCount, smsCount, totalSms };
    }, [phoneList, message]);

    const handleSend = async () => {
        if (stats.phones.length === 0) {
            toast.error('Lütfen en az bir telefon numarası girin.');
            return;
        }
        if (!message.trim()) {
            toast.error('Lütfen bir mesaj içeriği girin.');
            return;
        }

        setIsSending(true);
        const loadingToast = toast.loading(`${stats.phones.length} kişiye SMS gönderiliyor...`);

        try {
            const response = await fetch('/api/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phones: stats.phones,
                    text: message
                }),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                toast.success(`${result.sentCount || 0} SMS başarıyla gönderildi!`, { id: loadingToast });

                // Geçmişe ekle
                const newLog: SMSLog = {
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: new Date().toISOString(),
                    recipientCount: result.sentCount || 0,
                    message: message,
                    status: 'success',
                    details: result
                };
                setHistory([newLog, ...history]);

                // Formu temizle
                setPhoneList('');
                setMessage('');
            } else {
                const sentCount = result.sentCount || 0;
                const errorCount = result.errorCount || 0;
                const alertMessage = result.AlertMessage || result.message || 'Gönderim başarısız oldu.';

                const status = sentCount > 0 ? 'partial' : 'error';
                const toastMessage = sentCount > 0 || errorCount > 0
                    ? `${sentCount} başarılı, ${errorCount} hatalı.`
                    : alertMessage;

                toast.error(toastMessage, { id: loadingToast });

                const newLog: SMSLog = {
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: new Date().toISOString(),
                    recipientCount: sentCount,
                    message: message,
                    status: status,
                    details: result
                };
                setHistory([newLog, ...history]);
            }
        } catch (error: any) {
            console.error('SMS gönderim hatası:', error);
            toast.error(`Bağlantı hatası: ${error.message || 'Sunucuya erişilemiyor'}`, { id: loadingToast });
        } finally {
            setIsSending(false);
        }
    };

    const applyTemplate = (content: string) => {
        setMessage(content);
        setActiveTab('send');
        toast.info('Şablon uygulandı');
    };

    const handleCleanNumbers = () => {
        if (!phoneList.trim()) {
            toast.error('Temizlenecek numara bulunamadı.');
            return;
        }

        const lines = phoneList.split(/[\n,]+/);
        const cleanedSet = new Set<string>();

        lines.forEach(line => {
            // Sadece rakamları al (başındaki + dahil tüm karakterleri temizle)
            const digits = line.replace(/\D/g, '');

            if (!digits || digits.length < 7) return; // Minimum 7 hane (ülke kodu dahil)

            // Kopyaları önlemek için sete ekle
            cleanedSet.add(digits);
        });

        const cleanedList = Array.from(cleanedSet).join('\n');
        const diff = lines.length - cleanedSet.size;

        setPhoneList(cleanedList);

        if (diff > 0) {
            toast.success(`${diff} geçersiz veya kopya numara temizlendi.`);
        } else {
            toast.info('Numaralar zaten temiz görünüyor.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold italic tracking-tighter text-white uppercase">
                        SMS <span className="text-blue-500">MERKEZİ</span>
                    </h1>
                    <p className="text-[color:var(--panel-muted,#8a919c)] text-sm mt-1">Gelişmiş SMS yönetim paneli</p>
                </div>

                <div className="flex bg-white/5 p-1 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                    <button
                        onClick={() => setActiveTab('send')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                            activeTab === 'send' ? "bg-blue-600 text-white shadow-lg" : "text-[color:var(--panel-muted,#8a919c)] hover:text-white"
                        )}
                    >
                        <Send className="w-4 h-4" /> Gönder
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                            activeTab === 'templates' ? "bg-blue-600 text-white shadow-lg" : "text-[color:var(--panel-muted,#8a919c)] hover:text-white"
                        )}
                    >
                        <Layout className="w-4 h-4" /> Şablonlar
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                            activeTab === 'history' ? "bg-blue-600 text-white shadow-lg" : "text-[color:var(--panel-muted,#8a919c)] hover:text-white"
                        )}
                    >
                        <History className="w-4 h-4" /> Geçmiş
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'send' && (
                    <motion.div
                        key="send"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                    >
                        {/* Sol: Giriş Bölümü */}
                        <div className="lg:col-span-2 space-y-6">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-blue-500" /> ALICILAR
                                        </CardTitle>
                                        <button
                                            onClick={handleCleanNumbers}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg text-[10px] font-semibold uppercase tracking-widest border border-blue-500/20 transition-all"
                                            title="Numaraları temizle, kopyaları sil ve 90 formatına getir"
                                        >
                                            <Wand2 className="w-3.5 h-3.5" /> TEMİZLE
                                        </button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="relative">
                                        <textarea
                                            value={phoneList}
                                            onChange={(e) => setPhoneList(e.target.value)}
                                            placeholder="Telefon numaralarını girin (Her satıra bir numara veya virgülle ayırın...)"
                                            className="w-full bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl p-4 text-[color:var(--panel-text-dim,#c8cdd5)] placeholder:text-[color:var(--panel-faint,#5c6470)] focus:ring-2 focus:ring-blue-500/50 outline-none min-h-[150px] transition-all"
                                        />
                                        <div className="absolute top-3 right-3">
                                            <div className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/30">
                                                {stats.phones.length} Kişi
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-white">
                                        <MessageSquare className="w-4 h-4 text-blue-500" /> MESAJ İÇERİĞİ
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="relative">
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Mesajınızı buraya yazın..."
                                            className="w-full bg-black/50 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl p-4 text-[color:var(--panel-text-dim,#c8cdd5)] placeholder:text-[color:var(--panel-faint,#5c6470)] focus:ring-2 focus:ring-blue-500/50 outline-none min-h-[150px] transition-all"
                                        />
                                        <div className="absolute bottom-3 right-3 flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-[color:var(--panel-muted,#8a919c)]">
                                            <span>{stats.charCount} Karakter</span>
                                            <span className="text-blue-500">{stats.smsCount} SMS</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {['[NAME]', '[URL]', '[DATE]'].map(tag => (
                                            <button
                                                key={tag}
                                                onClick={() => setMessage(prev => prev + tag)}
                                                className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-lg text-xs text-[color:var(--panel-muted,#8a919c)] transition-colors"
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="pt-4 flex justify-end">
                                        <Button
                                            onClick={handleSend}
                                            disabled={isSending || stats.phones.length === 0}
                                            className="w-full md:w-auto min-w-[200px] h-14 rounded-xl bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 shadow-xl shadow-blue-500/20 group"
                                        >
                                            {isSending ? (
                                                <>
                                                    <Zap className="w-5 h-5 mr-2 animate-pulse" /> GÖNDERİLİYOR...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-5 h-5 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> SMS GÖNDER
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Sağ: Bilgi & Önizleme */}
                        <div className="space-y-6">
                            <Card className="bg-gradient-to-br from-blue-600/10 to-transparent border-blue-500/20">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Info className="w-4 h-4 text-blue-500" /> ÖZET BİLGİ
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                        <span className="text-sm text-[color:var(--panel-muted,#8a919c)]">Toplam Kişi</span>
                                        <span className="text-lg font-bold text-white">{stats.phones.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                        <span className="text-sm text-[color:var(--panel-muted,#8a919c)]">SMS / Kişi</span>
                                        <span className="text-lg font-bold text-white">{stats.smsCount}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-blue-600/20 rounded-xl border border-blue-500/30">
                                        <span className="text-sm text-blue-300 font-bold uppercase tracking-wider">Toplam Tahmini SMS</span>
                                        <span className="text-2xl font-semibold text-white">{stats.totalSms}</span>
                                    </div>

                                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200/70 leading-relaxed">
                                        <p className="flex gap-2">
                                            <AlertCircle className="w-12 h-12 text-amber-400 shrink-0" />
                                            Numaraların başında ülke kodu (örn: İngiltere için 44, Hollanda için 31, Türkiye için 90) olduğundan emin olun. 160 karakteri geçen mesajlar çoklu SMS olarak ücretlendirilir.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="relative group">
                                <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full transition-opacity group-hover:opacity-100 opacity-50" />
                                <div className="relative bg-[#0F0F12] border-8 border-[color:var(--panel-border,rgba(242,244,248,0.1))] rounded-xl p-4 shadow-2xl min-h-[400px]">
                                    <div className="w-20 h-1.5 bg-[color:var(--panel-surface-2,rgba(242,244,248,0.05))] rounded-full mx-auto mb-6" />
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">S</div>
                                        <div>
                                            <div className="text-[10px] font-bold text-[color:var(--panel-muted,#8a919c)] uppercase">GÖNDEREN</div>
                                            <div className="text-xs font-bold text-white tracking-widest uppercase">GÖNDERİCİ</div>
                                        </div>
                                    </div>
                                    <div className="bg-[rgba(242,244,248,0.80)] rounded-xl rounded-tl-none p-4 text-xs text-[color:var(--panel-text-dim,#c8cdd5)] leading-relaxed border border-[color:var(--panel-border,rgba(242,244,248,0.1))] backdrop-blur-md">
                                        {message || "Mesaj önizlemesi burada görünecek..."}
                                    </div>
                                    <div className="mt-2 text-[10px] text-[color:var(--panel-faint,#5c6470)] font-medium">Şimdi • SMS</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'templates' && (
                    <motion.div
                        key="templates"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {TEMPLATES.map((tmpl) => (
                            <Card key={tmpl.id} className="group hover:border-blue-500/50 transition-all cursor-pointer overflow-hidden" onClick={() => applyTemplate(tmpl.content)}>
                                <CardHeader className="bg-white/5 border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                    <div className="flex justify-between items-start">
                                        <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            UYGULA
                                        </Button>
                                    </div>
                                    <CardTitle className="mt-4 text-white font-bold">{tmpl.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <p className="text-sm text-[color:var(--panel-muted,#8a919c)] line-clamp-4 leading-relaxed italic">
                                        "{tmpl.content}"
                                    </p>
                                </CardContent>
                            </Card>
                        ))}

                        <Card className="border-dashed border-[color:var(--panel-border,rgba(242,244,248,0.1))] bg-transparent flex flex-center hover:bg-white/5 transition-all cursor-pointer min-h-[200px]">
                            <div className="m-auto text-center p-6">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                    <Trash2 className="w-5 h-5 text-[color:var(--panel-faint,#5c6470)]" />
                                </div>
                                <h3 className="text-sm font-bold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-widest">Özel Şablon Ekle</h3>
                                <p className="text-xs text-[color:var(--panel-faint,#5c6470)] mt-2">Yakında aktif olacak</p>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {activeTab === 'history' && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                    >
                        <Card className="overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5">
                                            <th className="p-4 text-xs font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em] border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">ZAMAN</th>
                                            <th className="p-4 text-xs font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em] border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">MESAJ</th>
                                            <th className="p-4 text-xs font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em] border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">ALICI</th>
                                            <th className="p-4 text-xs font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em] border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">DURUM</th>
                                            <th className="p-4 text-xs font-semibold text-[color:var(--panel-muted,#8a919c)] uppercase tracking-[0.2em] border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-12 text-center">
                                                    <History className="w-12 h-12 text-[color:var(--panel-faint,#5c6470)] mx-auto mb-4" />
                                                    <p className="text-[color:var(--panel-muted,#8a919c)] font-medium">Henüz bir gönderim geçmişi bulunmuyor.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            history.map((log) => (
                                                <tr key={log.id} className="hover:bg-white/5 transition-colors border-b border-[color:var(--panel-border,rgba(242,244,248,0.1))]">
                                                    <td className="p-4">
                                                        <div className="text-sm text-white font-medium">
                                                            {new Date(log.timestamp).toLocaleDateString('tr-TR')}
                                                        </div>
                                                        <div className="text-[10px] text-[color:var(--panel-muted,#8a919c)] font-bold">
                                                            {new Date(log.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 max-w-xs">
                                                        <p className="text-xs text-[color:var(--panel-muted,#8a919c)] line-clamp-1 italic">"{log.message}"</p>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-3 h-3 text-[color:var(--panel-muted,#8a919c)]" />
                                                            <span className="text-sm font-bold text-[color:var(--panel-text-dim,#c8cdd5)]">{log.recipientCount}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        {log.status === 'success' ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400 px-2 py-1 bg-emerald-500/10 rounded-lg">
                                                                <CheckCircle2 className="w-3 h-3" /> BAŞARILI
                                                            </span>
                                                        ) : log.status === 'partial' ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400 px-2 py-1 bg-amber-500/10 rounded-lg">
                                                                <AlertCircle className="w-3 h-3" /> KISMİ
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-rose-400 px-2 py-1 bg-rose-500/10 rounded-lg">
                                                                <AlertCircle className="w-3 h-3" /> HATALI
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => setMessage(log.message)}>
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
